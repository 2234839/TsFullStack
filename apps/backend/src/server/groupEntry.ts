import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Effect } from 'effect';
import { AppConfigService, type AppConfig } from '../Context/AppConfig';
import { GroupEntryService, isQrEffective } from '../services/GroupEntryService';
import { extractErrorMessage } from '../util/error';

/** 日志前缀 */
const LOG_PREFIX = '[GroupEntry]';

/** 动态图客户端缓存 5 分钟（过期切换最多延迟 5 分钟可见，GitHub CDN 可接受） */
const IMG_CACHE_CONTROL = 'public, max-age=300';

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
 * 生成「群码更新中」提示 SVG（shields.io 同款方案：服务器只拼字符串，中文由浏览器渲染，
 * 无 sharp/无服务器字体依赖；文案 + 公众号码引导关注）
 */
function buildFallbackSvg(options: { accountName: string; replyKeyword: string }): string {
  const line1 = '群码更新中';
  const line2 = `关注公众号「${options.accountName}」`;
  const line3 = `回复「${options.replyKeyword}」获取最新入群口令`;
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="180" viewBox="0 0 560 180" role="img" aria-label="群码更新中">',
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

/**
 * 落地页 HTML（移动端优先，微信内打开为主场景；无外部资源依赖）
 * 状态机：有效 → 展示群码大图；过期/缺失 → 展示公众号码 + 引导文案
 */
function buildLandingHtml(options: {
  entry: string;
  effective: boolean;
  qrDataUrl?: string;
  expiresAt?: string;
  groupName?: string;
  accountQrUrl?: string;
  accountName: string;
  replyKeyword: string;
}): string {
  const { entry, effective } = options;
  const mainBlock =
    effective && options.qrDataUrl
      ? [
          `<h1 class="title">扫码进群</h1>`,
          options.groupName ? `<p class="sub">${escapeHtml(options.groupName)}</p>` : '',
          `<img class="qr" src="${options.qrDataUrl}" alt="微信群二维码"/>`,
          options.expiresAt ? `<p class="meta">本码有效期至 ${escapeHtml(options.expiresAt)}</p>` : '',
          `<p class="tip">长按识别 / 扫码加入交流群</p>`,
        ].join('')
      : [
          `<h1 class="title">群码更新中</h1>`,
          options.accountQrUrl ? `<img class="qr" src="${escapeHtml(options.accountQrUrl)}" alt="公众号二维码"/>` : '',
          `<p class="tip">关注公众号「${escapeHtml(options.accountName)}」</p>`,
          `<p class="tip">回复「${escapeHtml(options.replyKeyword)}」，我会收到推送马上更新</p>`,
        ].join('');
  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>',
    `<title>${escapeHtml(entry)} 交流群</title>`,
    '<style>',
    ':root{color-scheme:dark}',
    'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif;color:#f8fafc}',
    '.card{max-width:420px;width:calc(100% - 48px);padding:40px 24px;margin:24px 0;background:#1e293b;border-radius:20px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.35)}',
    '.title{font-size:24px;margin:0 0 8px}',
    '.sub{color:#94a3b8;margin:0 0 16px;font-size:15px}',
    '.qr{width:min(72vw,300px);height:auto;border-radius:12px;background:#fff;padding:8px}',
    '.meta{color:#64748b;font-size:13px;margin:16px 0 0}',
    '.tip{color:#cbd5e1;font-size:15px;margin:16px 0 0;line-height:1.7}',
    '</style>',
    '</head>',
    '<body>',
    `<div class="card">${mainBlock}</div>`,
    '</body>',
    '</html>',
  ].join('');
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
 * 公开路由（无鉴权，面向 GitHub README 访客）：
 * - GET /group/:entry.png   动态图（有效期内返回群码，否则返回提示 SVG）
 * - GET /group/:entry       落地页（移动端优先，两态切换）
 *
 * 管理路由（x-admin-token）：
 * - POST /group/admin/qrcode            上传新群码（multipart，上传即生效）
 * - GET  /group/admin/qrcodes           群码池列表
 * - POST /group/admin/qrcode/:id/archive 手动下线
 * - GET  /group/admin/stats?days=30     引流统计
 *
 * @param appConfig 已加载的应用配置（服务启动后不可变，供 Effect 依赖注入与文案渲染）
 */
export function registerGroupEntryRoutes(fastify: FastifyInstance, appConfig: AppConfig) {
  /** 解析路由参数里的 entry（:entry 或 :entry.png），统一去掉 .png 后缀并转小写 */
  function parseEntry(raw: string): string | null {
    const entry = raw.toLowerCase().replace(/\.png$/, '');
    return /^[a-z0-9][a-z0-9-]{0,63}$/.test(entry) ? entry : null;
  }

  /** 动态图：README `<img>` 直接引用 */
  fastify.get('/group/:entry.png', async (req: FastifyRequest, reply: FastifyReply) => {
    const { entry: rawEntry } = req.params as { entry: string };
    const entry = parseEntry(rawEntry);
    if (!entry) {
      reply.code(400).send({ error: '非法入口标识' });
      return;
    }

    const config = appConfig.groupEntry;

    const active = await runEffect(GroupEntryService.getActiveQr(entry), appConfig, reply, null);
    if (reply.sent) return;

    /** 埋点放行后记录（fire-and-forget） */
    GroupEntryService.recordStat(entry, 'imgPv');

    if (active && isQrEffective(active.qr)) {
      reply
        .type(active.qr.imageMime)
        .header('Cache-Control', IMG_CACHE_CONTROL)
        .header('Content-Length', active.qr.imageSize);
      reply.send(GroupEntryService.openQrStream(active.absPath));
      return;
    }

    /** 过期/缺失：提示图（同样 200，README 里的图不能裂） */
    const svg = buildFallbackSvg({
      accountName: config?.officialAccountName ?? '公众号',
      replyKeyword: config?.replyKeyword ?? '加群',
    });
    reply.type('image/svg+xml; charset=utf-8').header('Cache-Control', IMG_CACHE_CONTROL).send(svg);
  });

  /** 落地页：微信内打开的主场景 */
  fastify.get('/group/:entry', async (req: FastifyRequest, reply: FastifyReply) => {
    const { entry: rawEntry } = req.params as { entry: string };
    const entry = parseEntry(rawEntry);
    if (!entry) {
      reply.code(400).send({ error: '非法入口标识' });
      return;
    }

    const config = appConfig.groupEntry;

    const active = await runEffect(GroupEntryService.getActiveQr(entry), appConfig, reply, null);
    if (reply.sent) return;

    /** UV：当日首次访问写 cookie（path 限定 /group，无 @fastify/cookie 时降级为只记 PV） */
    const rawCookie = req.headers.cookie ?? '';
    const isNewUv = !rawCookie.includes(`${UV_COOKIE}=`);
    if (isNewUv) {
      reply.header('Set-Cookie', `${UV_COOKIE}=${Date.now()}; Path=/group; Max-Age=${UV_COOKIE_MAX_AGE}; SameSite=Lax`);
    }
    GroupEntryService.recordStat(entry, 'pagePv');
    if (isNewUv) GroupEntryService.recordStat(entry, 'pageUv');

    /** 群码转 data URL 内嵌（落地页 no-store 避免缓存旧码；也不暴露原图路径） */
    let qrDataUrl: string | undefined;
    let effective = false;
    if (active && isQrEffective(active.qr)) {
      effective = true;
      const { readFile } = await import('fs/promises');
      const buf = await readFile(active.absPath);
      qrDataUrl = `data:${active.qr.imageMime};base64,${buf.toString('base64')}`;
    }

    const html = buildLandingHtml({
      entry,
      effective,
      qrDataUrl,
      expiresAt: active && isQrEffective(active.qr) ? formatLocalTime(active.qr.expiresAt) : undefined,
      groupName: active?.qr.groupName ?? undefined,
      accountQrUrl: config?.officialAccountQrUrl,
      accountName: config?.officialAccountName ?? '公众号',
      replyKeyword: config?.replyKeyword ?? '加群',
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

  /** 上传新群码（multipart：file + entry + groupName? + note?） */
  fastify.post('/group/admin/qrcode', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!guard(req, reply)) return;

    const file = await req.file();
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

    const entry = (fieldValue('entry') ?? '').trim().toLowerCase();
    const groupName = fieldValue('groupName');
    const note = fieldValue('note');

    const buffer = await file.toBuffer();

    const created = await runEffect(
      GroupEntryService.uploadQr({ entry, groupName, note, buffer, mime: file.mimetype }),
      appConfig,
      reply,
      null,
    );
    if (reply.sent) return;

    /** 上传回执（fire-and-forget，失败不影响响应） */
    GroupEntryService.notifyUpload(entry, groupName);
    reply.send({ success: true, qrcode: created });
  });

  /** 群码池列表 */
  fastify.get('/group/admin/qrcodes', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!guard(req, reply)) return;
    const list = await runEffect(GroupEntryService.listQrs(), appConfig, reply, []);
    if (reply.sent) return;
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
    const result = await runEffect(GroupEntryService.archiveQr(id), appConfig, reply, null);
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

  console.log(`${LOG_PREFIX} 私域引流路由已注册: /group/:entry(.png), /group/admin/*`);
}
