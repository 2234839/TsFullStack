import { Effect } from 'effect';
import { DbClientEffect } from '../Context/DbService';
import { AppConfigService } from '../Context/AppConfig';
import { fail, tryOrFail } from '../util/error';
import { GroupEntryService } from './GroupEntryService';
import { OauthProvider } from '../../.zenstack/models';

/** 日志前缀 */
const LOG_PREFIX = '[WechatCommand]';

/** 消息存档条目 */
export interface ArchiveMessageInput {
  channel: 'WECHAT_OFFICIAL';
  direction: 'IN' | 'OUT';
  msgType: string;
  /** 对端渠道身份（公众号=用户 openid） */
  peerId: string;
  content?: string;
  mediaId?: string;
}

/**
 * 消息存档：fire-and-forget 调用（失败不影响回复），openid 已绑定时回填 userId。
 * 管理页据此展示渠道消息列表（管理员看全部，用户只看自己的，权限在 zmodel 策略层）
 */
export function archiveMessage(input: ArchiveMessageInput): Effect.Effect<void, Error, AppConfigService> {
  return Effect.gen(function* () {
    const db = yield* DbClientEffect;
    const binding = yield* tryOrFail(`${LOG_PREFIX} 查询消息归属账号`, () =>
      db.oAuthAccount.findFirst({ where: { provider: OauthProvider.WECHAT, providerId: input.peerId } }),
    );
    yield* tryOrFail(`${LOG_PREFIX} 消息存档`, () =>
      db.channelMessage.create({
        data: {
          channel: input.channel,
          direction: input.direction,
          msgType: input.msgType,
          peerId: input.peerId,
          content: input.content ?? null,
          mediaId: input.mediaId ?? null,
          userId: binding?.userId ?? null,
        },
      }),
    );
  });
}

/** 待图会话有效期：发起指令后多久内发的图片会被当作上传内容 */
const PENDING_TTL_MS = 5 * 60 * 1000;

/** 待图会话条数上限（防泄漏式膨胀） */
const PENDING_MAX = 1000;

/**
 * 待图会话：openid → { 空间, 图片种类, 过期时间 }。
 * 读到即判过期（惰性清理），读到即删（一次性），属于 Effect 化白名单中的例外
 */
const pendingImages = new Map<
  string,
  { spaceId: number; spaceName: string; kind: 'groupQr' | 'officialQr'; expiresAt: number }
>();

/** 操作员身份：openid 经 OAuthAccount 换成账号，再带出其管理的空间列表 */
export interface OperatorIdentity {
  userId: string;
  /** 该账号被授权管理的空间（id + name） */
  spaces: { id: number; name: string }[];
}

/**
 * 解析公众号消息发送者身份：
 * openid → OAuthAccount(WECHAT) → userId → GroupSpaceOperator 空间列表
 * 返回 null = 未绑定微信或未被授权管理任何空间
 */
export function resolveOperator(openid: string): Effect.Effect<OperatorIdentity | null, Error, AppConfigService> {
  return Effect.gen(function* () {
    const db = yield* DbClientEffect;
    const binding = yield* tryOrFail(`${LOG_PREFIX} 查询微信绑定`, () =>
      db.oAuthAccount.findFirst({ where: { provider: OauthProvider.WECHAT, providerId: openid } }),
    );
    if (!binding) return null;
    const grants = yield* tryOrFail(`${LOG_PREFIX} 查询空间授权`, () =>
      db.groupSpaceOperator.findMany({
        where: { userId: binding.userId },
        include: { space: true },
      }),
    );
    if (grants.length === 0) return null;
    return {
      userId: binding.userId,
      spaces: grants.map((g) => ({ id: g.spaceId, name: g.space.name })),
    };
  });
}

/** 帮助文案 */
const HELP_TEXT = [
  '可用指令：',
  '/我的空间 —— 查看我管理的空间',
  '/状态 [空间名] —— 查看群码池（默认全部我的空间）',
  '/更新群码 <空间名> —— 然后直接发群二维码图片',
  '/更新公众号码 <空间名> —— 然后直接发公众号二维码图片',
  '/取消 —— 取消当前待上传状态',
].join('\n');

/** 按名字在自己的授权空间里找，找不到给出可选项提示 */
function findGrantedSpace(identity: OperatorIdentity, name: string): { id: number; name: string } | null {
  const key = name.trim().toLowerCase();
  return identity.spaces.find((s) => s.name === key) ?? null;
}

/** 记录待图会话（惰性清理过期项 + 上限保护） */
function setPending(openid: string, entry: { spaceId: number; spaceName: string; kind: 'groupQr' | 'officialQr' }) {
  const now = Date.now();
  for (const [k, v] of pendingImages) if (v.expiresAt < now) pendingImages.delete(k);
  while (pendingImages.size >= PENDING_MAX) {
    const oldest = pendingImages.keys().next().value;
    if (oldest === undefined) break;
    pendingImages.delete(oldest);
  }
  pendingImages.set(openid, { ...entry, expiresAt: now + PENDING_TTL_MS });
}

/** 查询某账号的空间群码状态文本（/状态 输出体） */
function spaceStatusText(spaces: { name: string }[]): Effect.Effect<string, Error, AppConfigService> {
  return Effect.gen(function* () {
    const all = yield* GroupEntryService.listSpaces();
    const mine = all.filter((s) => spaces.some((m) => m.name === s.name));
    if (mine.length === 0) return '你还没有被授权管理任何空间';
    const lines: string[] = [];
    for (const space of mine) {
      const active = space.qrcodes.filter((qr) => qr.status === 'ACTIVE');
      const serving = space.qrcodes.find((qr) => qr.serving);
      if (serving) {
        lines.push(
          `${space.name}：正在出码「${serving.groupName ?? space.displayName ?? space.name}」，过期 ${fmt(serving.expiresAt)}（ACTIVE 共 ${active.length} 个）`,
        );
      } else if (active.length > 0) {
        lines.push(`${space.name}：${active.length} 个 ACTIVE 码待轮换`);
      } else {
        lines.push(`${space.name}：⚠️ 无有效群码，请尽快 /更新群码 ${space.name}`);
      }
    }
    return lines.join('\n');
  });
}

/** 时间格式化（指令回复用，本地时区） */
function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * 处理 `/` 前缀文本指令。返回回复文本；null = 不是指令（调用方继续走关键词出码流程）。
 * 路由顺序约定（server/wechat.ts）：口令验证 → 本指令处理 → 关键词出码
 */
export function handleTextCommand(
  openid: string,
  content: string,
): Effect.Effect<string | null, Error, AppConfigService> {
  const text = content.trim();
  if (!text.startsWith('/')) return Effect.succeed(null);
  const [cmdRaw, ...rest] = text.split(/\s+/);
  const cmd = cmdRaw!.toLowerCase();
  const arg = rest.join(' ');

  return Effect.gen(function* () {
    /** 免鉴权指令：排查身份用 */
    if (cmd === '/我是谁') {
      const identity = yield* resolveOperator(openid);
      if (!identity) {
        return `openid：${openid.slice(0, 10)}***\n该微信未绑定账号或未被授权管理任何空间\n请在网站账号设置中绑定微信，并联系管理员授权空间`;
      }
      return `已绑定账号，管理空间：${identity.spaces.map((s) => s.name).join('、') || '（无）'}`;
    }

    const identity = yield* resolveOperator(openid);
    if (!identity) {
      return '⛔ 你没有指令权限（微信未绑定账号或未被授权管理空间）。可发 /我是谁 查看原因';
    }

    if (cmd === '/帮助' || cmd === '/help' || cmd === '/?') return HELP_TEXT;

    if (cmd === '/取消') {
      pendingImages.delete(openid);
      return '已取消待上传状态';
    }

    if (cmd === '/我的空间') {
      if (identity.spaces.length === 0) return '你还没有被授权管理任何空间';
      return identity.spaces.map((s) => s.name).join('、');
    }

    if (cmd === '/状态') {
      if (arg) {
        const space = findGrantedSpace(identity, arg);
        if (!space)
          return `⛔ 你没有空间「${arg}」的管理权限。你的空间：${identity.spaces.map((s) => s.name).join('、') || '（无）'}`;
        return yield* spaceStatusText([space]);
      }
      return yield* spaceStatusText(identity.spaces);
    }

    if (cmd === '/更新群码' || cmd === '/更新公众号码') {
      const kind: 'groupQr' | 'officialQr' = cmd === '/更新群码' ? 'groupQr' : 'officialQr';
      if (!arg) return `请指定空间名，如 ${cmd} ${identity.spaces[0]?.name ?? 'tsfullstack'}`;
      const space = findGrantedSpace(identity, arg);
      if (!space)
        return `⛔ 你没有空间「${arg}」的管理权限。你的空间：${identity.spaces.map((s) => s.name).join('、') || '（无）'}`;
      setPending(openid, { spaceId: space.id, spaceName: space.name, kind });
      return kind === 'groupQr'
        ? `收到，请直接发送空间「${space.name}」的新群二维码图片（5 分钟内有效，可发 /取消 取消）`
        : `收到，请直接发送空间「${space.name}」的新公众号二维码图片（5 分钟内有效，可发 /取消 取消）`;
    }

    return `未知指令 ${cmdRaw}\n${HELP_TEXT}`;
  });
}

/**
 * 处理图片消息：有待图会话时下载原图入库（群码入池 / 更新公众号码），无会话返回 null（不回复）。
 * 入库复用 GroupEntryService.uploadQr / uploadOfficialQr（含 mime/大小校验与文件落盘）
 */
export function handleImageMessage(
  openid: string,
  download: () => Promise<{ buffer: Buffer; mime: string }>,
): Effect.Effect<string | null, Error, AppConfigService> {
  return Effect.gen(function* () {
    const pending = pendingImages.get(openid);
    if (!pending || pending.expiresAt < Date.now()) {
      if (pending) pendingImages.delete(openid);
      return null;
    }
    /** 一次性：拿到会话即删，失败让用户重新发起指令，避免半吊子状态 */
    pendingImages.delete(openid);

    const identity = yield* resolveOperator(openid);
    if (!identity || !identity.spaces.some((s) => s.id === pending.spaceId)) {
      return '⛔ 你的空间权限已变化，请重新发起指令';
    }

    const image = yield* Effect.tryPromise({
      try: download,
      catch: (error: unknown) => new Error(`下载图片失败: ${error instanceof Error ? error.message : String(error)}`),
    });

    if (pending.kind === 'groupQr') {
      const qr = yield* GroupEntryService.uploadQr({
        spaceId: pending.spaceId,
        groupName: `公众号指令 ${fmt(new Date())}`,
        note: '公众号消息指令上传',
        buffer: image.buffer,
        mime: image.mime,
      });
      console.log(`${LOG_PREFIX} 空间 ${pending.spaceName} 群码经指令上传: id=${qr.id}`);
      return `✅ 群码已入池（空间 ${pending.spaceName}），过期 ${fmt(qr.expiresAt)}`;
    }
    yield* GroupEntryService.uploadOfficialQr({
      spaceId: pending.spaceId,
      buffer: image.buffer,
      mime: image.mime,
    });
    console.log(`${LOG_PREFIX} 空间 ${pending.spaceName} 公众号码经指令更新`);
    return `✅ 公众号二维码已更新（空间 ${pending.spaceName}）`;
  });
}
