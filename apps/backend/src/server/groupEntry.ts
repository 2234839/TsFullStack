import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Cache, Duration, Effect } from 'effect';
import { readFile } from 'node:fs/promises';
import { AppConfigService, type AppConfig } from '../Context/AppConfig';
import { GroupEntryService, isQrEffective, MAX_QR_UPLOAD_BYTES } from '../services/GroupEntryService';
import { extractErrorMessage } from '../util/error';
import { buildGroupEntrySvg } from './groupEntrySvg';

/** 日志前缀 */
const LOG_PREFIX = '[GroupEntry]';

/** 动态图客户端缓存 5 分钟（过期切换最多延迟 5 分钟可见，GitHub CDN 可接受） */
const IMG_CACHE_CONTROL = 'public, max-age=300';

/** README SVG 必须在每次加载时重新获取当前群码，同时禁止共享缓存与 CDN 缓存 */
const SVG_CACHE_CONTROL = 'no-cache, no-store, max-age=0, must-revalidate';

/** 管理令牌最小长度（弱值拒绝服务启动） */
const MIN_ADMIN_TOKEN_LEN = 16;

/** 落地页 UV cookie 名与有效期（当日） */
const UV_COOKIE = 'ge_uv';
const UV_COOKIE_MAX_AGE = 24 * 60 * 60;

/** XML 转义（SVG 文案注入防护） */
function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

/** 管理令牌校验：返回 null=通过，否则返回错误消息（管理接口整体禁用/令牌错误） */
function checkAdminToken(config: AppConfig['groupEntry'], req: FastifyRequest): string | null {
  if (!config?.adminToken) return '管理接口未启用：config.json 缺少 groupEntry.adminToken';
  if (config.adminToken.length < MIN_ADMIN_TOKEN_LEN) return '管理接口未启用：adminToken 弱值（<16 字符）';
  const provided = req.headers['x-admin-token'];
  if (typeof provided !== 'string' || provided !== config.adminToken) return '管理令牌无效';
  return null;
}

/** 统一的 Effect 运行辅助：为 Service 层程序注入 AppConfigService（DbClientEffect 亦依赖它），失败时回 500 并返回 fallback */
/** fire-and-forget：provide 后 runFork，失败仅记日志 */
function forkEffect(program: Effect.Effect<void, Error, AppConfigService>, appConfig: AppConfig): void {
  Effect.runFork(
    program.pipe(
      Effect.provideService(AppConfigService, appConfig),
      Effect.catch((e) => Effect.logWarning(`[GroupEntry] 后台任务失败（忽略）: ${extractErrorMessage(e)}`)),
    ),
  );
}

async function runEffect<T>(
  program: Effect.Effect<T, Error, AppConfigService>,
  appConfig: AppConfig,
  reply: FastifyReply,
  fallback: T,
): Promise<T> {
  try {
    return await Effect.runPromise(Effect.provideService(program, AppConfigService, appConfig));
  } catch (e) {
    console.error(`${LOG_PREFIX} 处理失败:`, extractErrorMessage(e));
    reply.code(500).send({ error: extractErrorMessage(e) });
    return fallback;
  }
}
/**
 * 生成无法入群时的提示 SVG：服务器只拼字符串，中文由浏览器渲染，无服务器字体依赖
 */
function buildFallbackSvg(options: { accountName: string; replyKeyword: string }): string {
  const line1 = '暂时无法扫码入群';
  const line2 = `微信关注公众号「${options.accountName}」`;
  const line3 = `回复「${options.replyKeyword}」获取最新入群方式`;
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="180" viewBox="0 0 560 180" role="img" aria-label="暂时无法扫码入群">',
    '<defs>',
    '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#0f172a"/>',
    '</linearGradient>',
    '</defs>',
    '<rect width="560" height="180" rx="16" fill="url(#g)"/>',
    `<text x="280" y="58" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif" font-size="26" font-weight="700" fill="#f8fafc" text-anchor="middle">${escapeXml(line1)}</text>`,
    `<text x="280" y="102" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif" font-size="17" fill="#cbd5e1" text-anchor="middle">${escapeXml(line2)}</text>`,
    `<text x="280" y="134" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif" font-size="17" fill="#cbd5e1" text-anchor="middle">${escapeXml(line3)}</text>`,
    '</svg>',
  ].join('');
}

/** 落地页 HTML：有效时同时展示群码与公众号，失效时以公众号为主引导 */
function buildLandingHtml(options: {
  space: string;
  effective: boolean;
  qrDataUrl?: string;
  expiresAt?: string;
  groupName?: string;
  accountQrUrl?: string;
  accountName: string;
  replyKeyword: string;
  guideText: string;
}): string {
  const { effective } = options;
  const groupBlock =
    effective && options.qrDataUrl
      ? [
          '<section class="card">',
          '<p class="eyebrow">微信群</p>',
          '<h1 class="title">扫码加入微信群</h1>',
          options.groupName ? `<p class="sub">${escapeHtml(options.groupName)}</p>` : '',
          `<img class="qr" src="${options.qrDataUrl}" alt="微信群二维码"/>`,
          options.expiresAt ? `<p class="meta">本群码预计于 ${escapeHtml(options.expiresAt)} 过期，请尽快扫码</p>` : '',
          '<p class="tip">使用微信扫码或长按识别二维码入群</p>',
          '</section>',
        ].join('')
      : [
          '<section class="card unavailable">',
          '<h1 class="title">暂时无法扫码入群</h1>',
          '<p class="tip">当前微信群二维码可能已过期、群已满或暂时停用。请通过下方公众号获取最新入群方式。</p>',
          '</section>',
        ].join('');
  const officialBlock = [
    '<section class="card">',
    '<p class="eyebrow">长期联系入口</p>',
    `<h2 class="title small">关注 ${escapeHtml(options.accountName)}</h2>`,
    options.accountQrUrl
      ? `<img class="qr official" src="${escapeHtml(options.accountQrUrl)}" alt="${escapeHtml(options.accountName)}公众号二维码"/>`
      : '<p class="tip">公众号二维码暂未配置，可在微信中搜索公众号名称。</p>',
    `<p class="tip">${escapeHtml(options.guideText)}<br/>在公众号回复「<strong>${escapeHtml(options.replyKeyword)}</strong>」获取最新入群方式。</p>`,
    '</section>',
  ].join('');
  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>',
    '<meta name="referrer" content="no-referrer"/>',
    `<title>${effective ? '扫码加入微信群' : '关注公众号获取入群方式'}</title>`,
    '<style>',
    ':root{color-scheme:light dark}',
    '*{box-sizing:border-box}',
    'body{margin:0;min-height:100vh;background:#f4f7f5;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif;color:#17251d}',
    'main{max-width:460px;width:calc(100% - 32px);margin:0 auto;padding:28px 0}',
    '.brand{text-align:center;color:#16844b;font-size:13px;font-weight:700;letter-spacing:.08em;margin:0 0 18px}',
    '.card{padding:26px 22px;background:#fff;border:1px solid #e1e8e3;border-radius:20px;text-align:center;box-shadow:0 12px 40px rgba(15,23,42,.06)}',
    '.card+.card{margin-top:16px}',
    '.title{font-size:24px;line-height:1.4;margin:6px 0 12px}',
    '.title.small{font-size:21px}',
    '.eyebrow{color:#16844b;font-size:12px;font-weight:700;letter-spacing:.1em;margin:0}',
    '.sub{color:#64748b;margin:0 0 16px;font-size:15px}',
    '.qr{display:block;width:min(70vw,270px);height:min(70vw,270px);object-fit:contain;margin:0 auto;border-radius:12px;background:#fff}',
    '.qr.official{width:min(58vw,220px);height:min(58vw,220px)}',
    '.meta{color:#94a3b8;font-size:12px;line-height:1.6;margin:14px 0 0}',
    '.tip{color:#526159;font-size:14px;margin:16px 0 0;line-height:1.8}',
    '.unavailable{background:#fff9f1;border-color:#f3d5ae}.unavailable .title{color:#9a4d12}',
    '.footer{text-align:center;color:#94a3b8;font-size:12px;line-height:1.7;margin:18px 12px 0}',
    '@media(prefers-color-scheme:dark){body{background:#101713;color:#e2e8f0}.card{background:#18211c;border-color:#2b3930}.sub,.tip{color:#a3b0a8}.unavailable{background:#2a2118;border-color:#70461f}.unavailable .title{color:#fdba74}.qr{padding:7px}}',
    '</style>',
    '</head>',
    '<body>',
    '<main><p class="brand">TSFULLSTACK</p>',
    groupBlock,
    officialBlock,
    `<p class="footer">微信群码可能过期或群满，${escapeHtml(options.accountName)} 会保留最新入群方式。</p></main>`,
    '</body>',
    '</html>',
  ].join('');
}

/** 公众号二维码可达性缓存：url -> ok（命中期内不再探测，与图片缓存粒度一致） */
const ACCOUNT_QR_CHECK_TTL_MS = 5 * 60 * 1000;
const accountQrReachability = Effect.runSync(
  Cache.make<string, boolean, never, never, never>({
    capacity: 200,
    timeToLive: Duration.millis(ACCOUNT_QR_CHECK_TTL_MS),
    lookup: (url) =>
      Effect.catch(
        Effect.map(
          Effect.promise(() => fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) })),
          (response) => response.ok && (response.headers.get('content-type') ?? '').startsWith('image/'),
        ),
        () => Effect.succeed(false),
      ),
  }),
);

/**
 * 探测公众号二维码图片可达性：失败时不输出 <img>，避免落地页出现裂图
 * 内部路由（/group/...）直接视为可用；外部 URL 探测失败按不可达处理（宁可少一张图，不给用户裂图）
 */
async function reachableAccountQrUrl(url: string | null | undefined): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith('/')) return url;
  if (url.startsWith('data:')) return url;
  const ok = await Effect.runPromise(Cache.get(accountQrReachability, url));
  return ok ? url : undefined;
}

/** 图片响应转 data URL；仅接受与上传白名单一致的位图格式，避免在 SVG 中嵌入主动内容 */
function bitmapDataUrl(buffer: Buffer, mime: string): string | undefined {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) return undefined;
  if (buffer.length === 0 || buffer.length > MAX_QR_UPLOAD_BYTES) return undefined;
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

/** 读取公众号码并内嵌到 SVG；未配置或外部图片不可用时保留公众号文字引导 */
async function officialQrDataUrl(
  space: string,
  qrUrl: string | null,
  appConfig: AppConfig,
  reply: FastifyReply,
): Promise<string | undefined> {
  if (!qrUrl) return undefined;
  if (qrUrl.startsWith('data:')) {
    return /^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/]+={0,2}$/.test(qrUrl) ? qrUrl : undefined;
  }
  if (qrUrl === `/group/official-qr/${space}.png`) {
    const image = await runEffect(GroupEntryService.getOfficialQrImage(space), appConfig, reply, null);
    if (!image || reply.sent) return undefined;
    const buffer = await readFile(image.absPath);
    return bitmapDataUrl(buffer, image.mime);
  }
  if (!qrUrl.startsWith('https://') && !qrUrl.startsWith('http://')) return undefined;
  try {
    const response = await fetch(qrUrl, { signal: AbortSignal.timeout(3000) });
    const mime = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (!response.ok || contentLength > MAX_QR_UPLOAD_BYTES) return undefined;
    return bitmapDataUrl(Buffer.from(await response.arrayBuffer()), mime);
  } catch (error: unknown) {
    console.error(`${LOG_PREFIX} 内嵌外部公众号二维码失败:`, extractErrorMessage(error));
    return undefined;
  }
}

/** HTML 转义（落地页注入防护） */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** 本地时间格式化（展示用） */
function formatLocalTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 注册私域引流路由
 *
 * 公开路由（无鉴权，面向项目 README 访客）：
 * - GET /group/:space.png            动态位图（有效期内返回群码，否则返回公众号引导 SVG）
 * - GET /group/:space.svg            无缓存动态 SVG（双码并排，无群码时仅公众号）
 * - GET /group/:space                落地页（移动端优先，两态切换；?from= 记录来源）
 * - GET /group/official-qr/:space.png 空间公众号二维码图片
 *
 * 管理路由（x-admin-token）：
 * - POST /group/admin/qrcode            上传新群码（multipart，space 即空间名，不存在自动建）
 * - GET  /group/admin/qrcodes           群码池列表
 * - POST /group/admin/qrcode/:id/archive 手动下线
 * - GET  /group/admin/stats?days=30     引流统计（按 空间+来源 聚合）
 *
 * @param appConfig 已加载的应用配置（服务启动后不可变，供 Effect 依赖注入与文案渲染）
 */
export function registerGroupEntryRoutes(fastify: FastifyInstance, appConfig: AppConfig) {
  /** 解析公开路由参数里的空间名，统一去掉图片后缀并转小写 */
  function parseSpace(raw: string): string | null {
    const space = raw.toLowerCase().replace(/\.(?:png|svg)$/, '');
    return /^[a-z0-9][a-z0-9-]{0,63}$/.test(space) ? space : null;
  }

  /** 读取链接上的来源参数（?from=），非法值视为空 */
  function parseFrom(req: FastifyRequest): string {
    const from = (req.query as { from?: string }).from ?? '';
    return /^[a-zA-Z0-9_-]{0,64}$/.test(from.trim()) ? from.trim() : '';
  }

  /** 空间的公众号二维码图片 */
  fastify.get('/group/official-qr/:space.png', async (req: FastifyRequest, reply: FastifyReply) => {
    const space = parseSpace((req.params as { space: string }).space);
    if (!space) {
      reply.code(400).send({ error: '非法空间标识' });
      return;
    }
    const image = await runEffect(GroupEntryService.getOfficialQrImage(space), appConfig, reply, null);
    if (reply.sent) return;
    if (!image) {
      reply.code(404).send({ error: '公众号二维码尚未配置' });
      return;
    }
    try {
      const buffer = await readFile(image.absPath);
      /** 公众号码更新频率低但必须换图立即可见，禁用缓存（管理员上传后马上要看到新图） */
      return reply.type(image.mime).header('Cache-Control', 'no-cache').send(buffer);
    } catch (error: unknown) {
      console.error(`${LOG_PREFIX} 读取公众号二维码失败:`, extractErrorMessage(error));
      reply.code(404).send({ error: '公众号二维码不可用' });
    }
  });

  /** 动态图：README `<img>` 直接引用 */
  fastify.get('/group/:space.png', async (req: FastifyRequest, reply: FastifyReply) => {
    const space = parseSpace((req.params as { space: string }).space);
    if (!space) {
      reply.code(400).send({ error: '非法空间标识' });
      return;
    }

    const active = await runEffect(GroupEntryService.getActiveQr(space), appConfig, reply, null);
    if (reply.sent) return;

    /** 埋点放行后记录（fire-and-forget），from 记录来源项目/渠道 */
    forkEffect(GroupEntryService.recordStat(space, parseFrom(req), 'imgPv') ?? Effect.void, appConfig);

    if (active?.qr && isQrEffective(active.qr)) {
      reply
        .type(active.qr.imageMime)
        .header('Cache-Control', IMG_CACHE_CONTROL)
        .header('Content-Length', active.qr.imageSize);
      /** fastify v5：async handler 中发送 stream 必须 return reply.send()，否则 handler resolve undefined 会把未发送的流覆盖为空 body */
      return reply.send(GroupEntryService.openQrStream(active.qr.absPath));
    }

    /** 过期/缺失：公众号引导图（同样 200，README 里的图不能裂） */
    const official = active?.official;
    const svg = buildFallbackSvg({
      accountName: official?.name || '公众号',
      replyKeyword: official?.replyKeyword || '加群',
    });
    reply.type('image/svg+xml; charset=utf-8').header('Cache-Control', IMG_CACHE_CONTROL).send(svg);
  });

  /** README 动态 SVG：双码并排；无有效群码时只展示公众号。所有二维码内嵌，响应禁止缓存 */
  fastify.get('/group/:space.svg', async (req: FastifyRequest, reply: FastifyReply) => {
    const space = parseSpace((req.params as { space: string }).space);
    if (!space) {
      reply.code(400).send({ error: '非法空间标识' });
      return;
    }

    const active = await runEffect(GroupEntryService.getActiveQr(space), appConfig, reply, null);
    if (reply.sent) return;
    forkEffect(GroupEntryService.recordStat(space, parseFrom(req), 'imgPv') ?? Effect.void, appConfig);

    const activeQr = active?.qr && isQrEffective(active.qr) ? active.qr : null;
    const group = activeQr
      ? {
          dataUrl: bitmapDataUrl(await readFile(activeQr.absPath), activeQr.imageMime),
          title: activeQr.groupName || '微信群',
          hint: '微信扫码入群',
        }
      : undefined;
    const official = active?.official;
    const accountName = official?.name || '公众号';
    const replyKeyword = official?.replyKeyword || '加群';
    const svg = buildGroupEntrySvg({
      group,
      official: {
        dataUrl: await officialQrDataUrl(space, official?.qrUrl ?? null, appConfig, reply),
        title: accountName,
        hint: `关注后回复「${replyKeyword}」`,
      },
    });
    if (reply.sent) return;
    return reply
      .type('image/svg+xml; charset=utf-8')
      .header('Cache-Control', SVG_CACHE_CONTROL)
      .header('CDN-Cache-Control', 'no-store')
      .header('Pragma', 'no-cache')
      .header('Expires', '0')
      .send(svg);
  });

  /** 落地页：微信内打开的主场景 */
  fastify.get('/group/:space', async (req: FastifyRequest, reply: FastifyReply) => {
    const space = parseSpace((req.params as { space: string }).space);
    if (!space) {
      reply.code(400).send({ error: '非法空间标识' });
      return;
    }

    const active = await runEffect(GroupEntryService.getActiveQr(space), appConfig, reply, null);
    if (reply.sent) return;

    /** UV：当日首次访问写 cookie（path 限定 /group，无 @fastify/cookie 时降级为只记 PV） */
    const rawCookie = req.headers.cookie ?? '';
    const isNewUv = !rawCookie.includes(`${UV_COOKIE}=`);
    if (isNewUv) {
      reply.header('Set-Cookie', `${UV_COOKIE}=${Date.now()}; Path=/group; Max-Age=${UV_COOKIE_MAX_AGE}; SameSite=Lax`);
    }
    /** from 记录用户从哪个项目/渠道过来（链接 ?from= 参数） */
    const from = parseFrom(req);
    forkEffect(GroupEntryService.recordStat(space, from, 'pagePv') ?? Effect.void, appConfig);
    if (isNewUv) forkEffect(GroupEntryService.recordStat(space, from, 'pageUv') ?? Effect.void, appConfig);

    /** 群码转 data URL 内嵌（落地页 no-store 避免缓存旧码；也不暴露原图路径） */
    const activeQr = active?.qr && isQrEffective(active.qr) ? active.qr : null;
    let qrDataUrl: string | undefined;
    let effective = false;
    if (activeQr) {
      effective = true;
      const buf = await readFile(activeQr.absPath);
      qrDataUrl = `data:${activeQr.imageMime};base64,${buf.toString('base64')}`;
    }

    /** 公众号引导：空间配置优先（内部路由直接可用），外部回退 URL 需探测可达性 */
    const official = active?.official;
    const accountQrUrl = official?.qrUrl ? await reachableAccountQrUrl(official.qrUrl) : undefined;
    const html = buildLandingHtml({
      space,
      effective,
      qrDataUrl,
      expiresAt: activeQr ? formatLocalTime(activeQr.expiresAt) : undefined,
      groupName: activeQr?.groupName ?? undefined,
      accountQrUrl,
      accountName: official?.name || '公众号',
      replyKeyword: official?.replyKeyword || '加群',
      guideText: official?.guideText || '关注公众号，群码更新和入群方式有变化时可以及时收到通知。',
    });
    reply.type('text/html; charset=utf-8').header('Cache-Control', 'no-store').send(html);
  });

  /** 管理接口集合：统一在 handler 内先做令牌校验 */
  function guard(req: FastifyRequest, reply: FastifyReply): boolean {
    const config = appConfig.groupEntry;
    const err = checkAdminToken(config, req);
    if (err) {
      reply.code(config?.adminToken ? 401 : 503).send({ error: err });
      return false;
    }
    return true;
  }

  /** 上传新群码（multipart：file + space + groupName? + note?） */
  fastify.post('/group/admin/qrcode', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!guard(req, reply)) return;

    const file = await req.file({ limits: { fileSize: MAX_QR_UPLOAD_BYTES } });
    if (!file) {
      reply.code(400).send({ error: '缺少图片文件（multipart 字段名 file）' });
      return;
    }

    /** multipart 文本字段可能是单值或数组（同名多值），统一取首值 */
    const fieldValue = (name: string): string | undefined => {
      const field = file.fields[name];
      if (!field) return undefined;
      if (Array.isArray(field)) return field[0] !== undefined ? String(field[0].value) : undefined;
      if ('value' in field && typeof field.value === 'string') return field.value;
      return undefined;
    };

    /** 兼容旧脚本的 entry 字段名，语义即空间名；空间不存在自动创建 */
    const space = (fieldValue('space') ?? fieldValue('entry') ?? '').trim().toLowerCase();
    const groupName = fieldValue('groupName');
    const note = fieldValue('note');

    const buffer = await file.toBuffer();
    const ensured = await runEffect(GroupEntryService.ensureSpace(space), appConfig, reply, null);
    if (reply.sent || !ensured) return;

    const created = await runEffect(
      GroupEntryService.uploadQr({ spaceId: ensured.id, groupName, note, buffer, mime: file.mimetype }),
      appConfig,
      reply,
      null,
    );
    if (reply.sent) return;

    /** 上传回执（fire-and-forget，失败不影响响应） */
    forkEffect(GroupEntryService.notifyUpload(ensured.name, groupName), appConfig);
    reply.send({ success: true, qrcode: created });
  });

  /** 群码池列表 */
  fastify.get('/group/admin/qrcodes', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!guard(req, reply)) return;
    const spaces = await runEffect(GroupEntryService.listSpaces(), appConfig, reply, []);
    if (reply.sent) return;
    const list = spaces.flatMap((space) =>
      space.qrcodes.map((qr) => ({ ...qr, spaceId: space.id, spaceName: space.name })),
    );
    reply.send({ items: list });
  });

  /** 手动下线 */
  fastify.post('/group/admin/qrcode/:id/archive', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!guard(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      reply.code(400).send({ error: '非法 id' });
      return;
    }
    const result = await runEffect(GroupEntryService.setQrStatus(id, 'ARCHIVED'), appConfig, reply, null);
    if (reply.sent) return;
    reply.send(result);
  });

  /** 引流统计 */
  fastify.get('/group/admin/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!guard(req, reply)) return;
    const days = Number((req.query as { days?: string }).days ?? 30);
    const stats = await runEffect(GroupEntryService.getStats(days), appConfig, reply, null);
    if (reply.sent) return;
    reply.send(stats);
  });

  console.log(`${LOG_PREFIX} 私域引流路由已注册: /group/:space(.png), /group/official-qr/:space.png, /group/admin/*`);
}
