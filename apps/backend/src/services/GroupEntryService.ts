import { Effect } from 'effect';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname, resolve, sep } from 'path';
import { createReadStream } from 'fs';
import { v7 as uuidv7 } from 'uuid';
import { DbClientEffect } from '../Context/DbService';
import { AppConfigService, type AppConfig } from '../Context/AppConfig';
import { fail, tryOrFail, MsgError, extractErrorMessage } from '../util/error';
import { MS_PER_HOUR } from '../util/constants';
import { imageExtFromMime, isValidImageMime } from '../util/image';
import type { GroupQRCode, GroupSpace } from '../../.zenstack/models';

/** 日志前缀 */
const LOG_PREFIX = '[GroupEntry]';

/** 微信群码默认有效天数 */
export const GROUP_QR_TTL_DAYS = 7;
const QR_TTL_MS = GROUP_QR_TTL_DAYS * 24 * MS_PER_HOUR;

/** 到期提前量：5 分钟（宁早勿晚，用户扫到过期码体验最差） */
const EXPIRY_EARLY_MS = 5 * 60 * 1000;

/** 统计表当日日期字符串（本地时区，YYYY-MM-DD） */
function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 上传大小上限 5MB，同时供服务层校验与 multipart 读取限制使用 */
export const MAX_QR_UPLOAD_BYTES = 5 * 1024 * 1024;

/** 群码与公众号码存储子目录（相对 uploadDir） */
const QR_SUBDIR = 'group-entry';
const OFFICIAL_QR_SUBDIR = 'group-entry/official-account';

/** 空间标识白名单（公开链接 /group/<name> 的永久锚点） */
const KEY_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** 来源参数白名单（链接 ?from= 的值，自由但需 URL 安全） */
const FROM_RE = /^[a-zA-Z0-9_-]{0,64}$/;

/** 校验空间标识格式 */
function assertKey(key: string): Effect.Effect<void, MsgError> {
  if (!KEY_RE.test(key)) return Effect.fail(MsgError.msg(`非法标识: ${key}`));
  return Effect.succeed(undefined);
}

/** 图片路径统一限制在 uploadDir 内 */
function resolveImagePath(uploadDir: string, imagePath: string): string {
  const absPath = resolve(uploadDir, imagePath);
  if (!absPath.startsWith(resolve(uploadDir) + sep)) throw new Error(`图片路径越界: ${imagePath}`);
  return absPath;
}

/** 群码是否仍有效（按 expiresAt - 5min 惰性计算，无定时任务） */
export function isQrEffective(qr: Pick<GroupQRCode, 'status' | 'expiresAt'>): boolean {
  return qr.status === 'ACTIVE' && qr.expiresAt.getTime() - EXPIRY_EARLY_MS > Date.now();
}

/** 出口视图：管理列表项（不暴露 imagePath 原始路径） */
export type GroupQRCodeView = Omit<GroupQRCode, 'imagePath'> & {
  /** 该表当前只保存限时微信群码，长期公众号二维码由独立配置管理 */
  kind: 'WECHAT_GROUP';
  /** 与公开路由使用相同的有效期和状态判断 */
  effective: boolean;
};

function toView(qr: GroupQRCode): GroupQRCodeView {
  const { imagePath: _hidden, ...view } = qr;
  return { ...view, kind: 'WECHAT_GROUP', effective: isQrEffective(qr) };
}

/** 空间的公众号引导配置（空间字段 + config.json 回退后的公开视图） */
export interface SpaceOfficialView {
  /** 公众号名称（空间未配置时回退配置文件） */
  name: string;
  /** 回复关键词 */
  replyKeyword: string;
  /** 引导语 */
  guideText: string | null;
  /** 二维码公开地址（后台上传时为内部路由，否则回退配置文件 URL） */
  qrUrl: string | null;
}

/** 空间主视图：公众号引导 + 群码池 */
export interface GroupSpaceView {
  /** 空间 id */
  id: number;
  /** 空间标识（/group/<name>） */
  name: string;
  /** 显示名 */
  displayName: string | null;
  /** 公众号引导（含回退） */
  official: SpaceOfficialView;
  /** 群码池（含 serving 标记） */
  qrcodes: (GroupQRCodeView & { serving: boolean })[];
}

/** 公众号名称：空间字段优先，回退 config，最终回退「公众号」（口令登录/账号页/空间视图共用） */
export function officialName(
  space: Pick<GroupSpace, 'officialName'> | null | undefined,
  config?: AppConfig['groupEntry'],
): string {
  return space?.officialName || config?.officialAccountName || '公众号';
}

/** 公众号二维码 URL：空间后台上传优先（走 /group/official-qr 路由），回退 config 外链 */
export function officialQrUrl(
  space: Pick<GroupSpace, 'name' | 'officialQrImagePath'> | null | undefined,
  config?: AppConfig['groupEntry'],
): string | null {
  return space?.officialQrImagePath ? `/group/official-qr/${space.name}.png` : (config?.officialAccountQrUrl ?? null);
}

/** 空间公众号公开视图：空间字段优先，未配置时回退 config.json */
function spaceOfficialView(
  space: Pick<
    GroupSpace,
    'name' | 'officialName' | 'officialReplyKeyword' | 'officialGuideText' | 'officialQrImagePath'
  >,
  config?: AppConfig['groupEntry'],
): SpaceOfficialView {
  return {
    name: officialName(space, config),
    replyKeyword: space.officialReplyKeyword || config?.replyKeyword || '加群',
    guideText: space.officialGuideText,
    qrUrl: officialQrUrl(space, config),
  };
}

/**
 * 私域引流服务：私域空间持有公众号引导 + 群码池。
 * 公开链接 = /group/<空间名>，永久不变；来源项目/渠道用链接 ?from= 参数记录（不建实体）。
 * 有效群码按上传时间先进先出；标满或过期后自动切下一个，无有效码时以公众号为主要引导。
 */
export const GroupEntryService = {
  /** 查询空间的当前出码与公众号配置；空间不存在时返回 null；qr 非空时必带 absPath */
  getActiveQr(
    spaceName: string,
  ): Effect.Effect<
    { qr: (GroupQRCode & { absPath: string }) | null; spaceName: string; official: SpaceOfficialView } | null,
    Error,
    AppConfigService
  > {
    return Effect.gen(function* () {
      yield* assertKey(spaceName);
      const db = yield* DbClientEffect;
      const space = yield* tryOrFail('查询空间', () => db.groupSpace.findUnique({ where: { name: spaceName } }));
      if (!space) return null;
      const pool = yield* tryOrFail('查询空间群码池', () =>
        db.groupQRCode.findMany({
          where: { spaceId: space.id, status: 'ACTIVE' },
          orderBy: { uploadedAt: 'asc' },
        }),
      );
      const { uploadDir, groupEntry: config } = yield* AppConfigService;
      const official = spaceOfficialView(space, config);
      const qr = pool.find(isQrEffective);
      if (!qr) return { qr: null, spaceName: space.name, official };
      return {
        qr: { ...qr, absPath: resolveImagePath(uploadDir, qr.imagePath) },
        spaceName: space.name,
        official,
      };
    });
  },

  /** 按公众号回复关键词查空间出码：先精确匹配空间关键词，未命中且等于默认关键词时取排序最前的空间 */
  getActiveQrByReplyKeyword(
    keyword: string,
  ): Effect.Effect<
    { qr: (GroupQRCode & { absPath: string }) | null; spaceName: string; official: SpaceOfficialView } | null,
    Error,
    AppConfigService
  > {
    return Effect.gen(function* () {
      const db = yield* DbClientEffect;
      const kw = keyword.trim();
      const { groupEntry: config } = yield* AppConfigService;
      const exact = yield* tryOrFail('按关键词查询空间', () =>
        db.groupSpace.findFirst({
          where: { officialReplyKeyword: kw },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        }),
      );
      let space = exact;
      if (!space && kw === (config?.replyKeyword || '加群')) {
        space = yield* tryOrFail('按默认关键词查询空间', () =>
          db.groupSpace.findFirst({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
        );
      }
      if (!space) return null;
      const pool = yield* tryOrFail('查询空间群码池', () =>
        db.groupQRCode.findMany({
          where: { spaceId: space.id, status: 'ACTIVE' },
          orderBy: { uploadedAt: 'asc' },
        }),
      );
      const { uploadDir } = yield* AppConfigService;
      const official = spaceOfficialView(space, config);
      const qr = pool.find(isQrEffective);
      if (!qr) return { qr: null, spaceName: space.name, official };
      return {
        qr: { ...qr, absPath: resolveImagePath(uploadDir, qr.imagePath) },
        spaceName: space.name,
        official,
      };
    });
  },

  /** 上传群码到空间池，不归档其他有效码，多个码按上传顺序轮换 */
  uploadQr(options: {
    spaceId: number;
    groupName?: string;
    note?: string;
    buffer: Buffer;
    mime: string;
  }): Effect.Effect<GroupQRCodeView, Error, AppConfigService> {
    return Effect.gen(function* () {
      if (!isValidImageMime(options.mime)) {
        return yield* fail(`不支持的图片类型: ${options.mime}（仅 png/jpeg/webp）`);
      }
      if (options.buffer.length === 0 || options.buffer.length > MAX_QR_UPLOAD_BYTES) {
        return yield* fail(`图片大小须在 1B ~ 5MB 之间，当前 ${options.buffer.length} 字节`);
      }
      const db = yield* DbClientEffect;
      const space = yield* tryOrFail('查询空间', () => db.groupSpace.findUnique({ where: { id: options.spaceId } }));
      if (!space) return yield* fail(`私域空间不存在: ${options.spaceId}`);
      const { uploadDir } = yield* AppConfigService;
      const ext = imageExtFromMime(options.mime);
      const relPath = join(QR_SUBDIR, `${uuidv7()}.${ext}`);
      const absPath = join(uploadDir, relPath);
      yield* tryOrFail('创建群码目录', () => mkdir(dirname(absPath), { recursive: true }));
      yield* tryOrFail('写入群码图片', () => writeFile(absPath, options.buffer));
      const now = new Date();
      const created = yield* tryOrFail('创建群码记录', () =>
        db.groupQRCode.create({
          data: {
            spaceId: options.spaceId,
            groupName: options.groupName,
            imagePath: relPath,
            imageSize: options.buffer.length,
            imageMime: options.mime,
            uploadedAt: now,
            expiresAt: new Date(now.getTime() + QR_TTL_MS),
            status: 'ACTIVE',
            note: options.note,
          },
        }),
      );
      console.log(`${LOG_PREFIX} 空间 ${space.name} 新群码已入池: id=${created.id}`);
      return toView(created);
    });
  },

  /** 切换群码状态：FULL 表示群已满，公开链接自动切到下一个有效码 */
  setQrStatus(
    id: number,
    status: 'FULL' | 'ARCHIVED' | 'ACTIVE',
  ): Effect.Effect<{ success: true }, Error, AppConfigService> {
    return Effect.gen(function* () {
      const db = yield* DbClientEffect;
      const updated = yield* tryOrFail('更新群码状态', () =>
        db.groupQRCode.update({ where: { id }, data: { status } }),
      );
      console.log(`${LOG_PREFIX} 群码 id=${id}（空间=${updated.spaceId}）状态切换为 ${status}`);
      return { success: true as const };
    });
  },

  /** 空间主视图：公众号引导 + 群码池 */
  listSpaces(): Effect.Effect<GroupSpaceView[], Error, AppConfigService> {
    return Effect.gen(function* () {
      const db = yield* DbClientEffect;
      const { groupEntry: config } = yield* AppConfigService;
      const spaces = yield* tryOrFail('查询空间列表', () =>
        db.groupSpace.findMany({
          include: { qrcodes: { orderBy: { uploadedAt: 'asc' } } },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        }),
      );
      return spaces.map((space) => {
        const servingId = space.qrcodes.find(isQrEffective)?.id;
        return {
          id: space.id,
          name: space.name,
          displayName: space.displayName,
          official: spaceOfficialView(space, config),
          qrcodes: space.qrcodes.map((qr) => ({ ...toView(qr), serving: qr.id === servingId })),
        };
      });
    });
  },

  /** 兼容旧脚本：空间不存在时自动创建，存在则直接返回 */
  ensureSpace(name: string): Effect.Effect<{ id: number; name: string }, Error, AppConfigService> {
    return Effect.gen(function* () {
      const key = name.trim().toLowerCase();
      yield* assertKey(key);
      const db = yield* DbClientEffect;
      const space = yield* tryOrFail('确保空间存在', () =>
        db.groupSpace.upsert({ where: { name: key }, create: { name: key }, update: {} }),
      );
      return { id: space.id, name: space.name };
    });
  },

  /** 创建私域空间 */
  createSpace(options: { name: string; displayName?: string }): Effect.Effect<{ id: number }, Error, AppConfigService> {
    return Effect.gen(function* () {
      const name = options.name.trim().toLowerCase();
      yield* assertKey(name);
      const db = yield* DbClientEffect;
      const created = yield* tryOrFail('创建空间', () =>
        db.groupSpace.create({ data: { name, displayName: options.displayName?.trim() || null } }),
      );
      return { id: created.id };
    });
  },

  /** 删除空间及其群码记录；历史统计与已上传图片文件保留 */
  deleteSpace(id: number): Effect.Effect<{ success: true }, Error, AppConfigService> {
    return Effect.gen(function* () {
      const db = yield* DbClientEffect;
      const space = yield* tryOrFail('删除空间及关联数据', () =>
        db.$transaction(async (tx) => {
          const existing = await tx.groupSpace.findUnique({ where: { id } });
          if (!existing) throw MsgError.msg(`私域空间不存在: ${id}`);
          await tx.groupQRCode.deleteMany({ where: { spaceId: id } });
          await tx.groupSpace.delete({ where: { id } });
          return existing;
        }),
      );
      console.log(`${LOG_PREFIX} 空间 ${space.name} 及其群码记录已删除`);
      return { success: true as const };
    });
  },

  /** 保存空间的公众号名称、关键词和引导语 */
  updateOfficialAccount(
    spaceId: number,
    options: { name: string; replyKeyword?: string; guideText?: string },
  ): Effect.Effect<SpaceOfficialView, Error, AppConfigService> {
    return Effect.gen(function* () {
      const name = options.name.trim();
      if (!name) return yield* fail('公众号名称不能为空');
      const db = yield* DbClientEffect;
      const space = yield* tryOrFail('更新空间公众号配置', () =>
        db.groupSpace.update({
          where: { id: spaceId },
          data: {
            officialName: name,
            officialReplyKeyword: options.replyKeyword?.trim() || '加群',
            officialGuideText: options.guideText?.trim() || null,
          },
        }),
      );
      const { groupEntry: config } = yield* AppConfigService;
      return spaceOfficialView(space, config);
    });
  },

  /** 上传空间的公众号二维码 */
  uploadOfficialQr(options: {
    spaceId: number;
    buffer: Buffer;
    mime: string;
  }): Effect.Effect<SpaceOfficialView, Error, AppConfigService> {
    return Effect.gen(function* () {
      if (!isValidImageMime(options.mime)) {
        return yield* fail(`不支持的图片类型: ${options.mime}（仅 png/jpeg/webp）`);
      }
      if (options.buffer.length === 0 || options.buffer.length > MAX_QR_UPLOAD_BYTES) {
        return yield* fail(`图片大小须在 1B ~ 5MB 之间，当前 ${options.buffer.length} 字节`);
      }
      const db = yield* DbClientEffect;
      const space = yield* tryOrFail('查询空间', () => db.groupSpace.findUnique({ where: { id: options.spaceId } }));
      if (!space) return yield* fail(`私域空间不存在: ${options.spaceId}`);
      const { uploadDir } = yield* AppConfigService;
      const ext = imageExtFromMime(options.mime);
      const relPath = join(OFFICIAL_QR_SUBDIR, `${uuidv7()}.${ext}`);
      const absPath = join(uploadDir, relPath);
      yield* tryOrFail('创建公众号码目录', () => mkdir(dirname(absPath), { recursive: true }));
      yield* tryOrFail('写入公众号二维码', () => writeFile(absPath, options.buffer));
      const updated = yield* tryOrFail('更新公众号码路径', () =>
        db.groupSpace.update({ where: { id: space.id }, data: { officialQrImagePath: relPath } }),
      );
      const { groupEntry: config } = yield* AppConfigService;
      return spaceOfficialView(updated, config);
    });
  },

  /** 空间的公众号二维码图片（公开路由出图用） */
  getOfficialQrImage(
    spaceName: string,
  ): Effect.Effect<{ absPath: string; mime: string } | null, Error, AppConfigService> {
    return Effect.gen(function* () {
      yield* assertKey(spaceName);
      const db = yield* DbClientEffect;
      const space = yield* tryOrFail('查询空间公众号二维码', () =>
        db.groupSpace.findUnique({ where: { name: spaceName } }),
      );
      if (!space?.officialQrImagePath) return null;
      const { uploadDir } = yield* AppConfigService;
      const extension = space.officialQrImagePath.split('.').pop();
      const mime = extension === 'jpg' ? 'image/jpeg' : extension === 'webp' ? 'image/webp' : 'image/png';
      return { absPath: resolveImagePath(uploadDir, space.officialQrImagePath), mime };
    });
  },

  /**
   * 引流埋点：upsert 当日计数。返回 Effect 由调用方 provide AppConfigService 并 runFork（fire-and-forget，失败仅记日志）
   * @param space 空间标识（/group/<space>）
   * @param from 来源参数（链接 ?from= 的值，空字符串 = 未携带）
   * @param kind 埋点类型：imgPv（动态图）/ pagePv（落地页）/ pageUv（落地页当日新 cookie）
   * @returns 入参非法时返回 null
   */
  recordStat(
    space: string,
    from: string,
    kind: 'imgPv' | 'pagePv' | 'pageUv',
  ): Effect.Effect<void, MsgError, AppConfigService> | null {
    if (!KEY_RE.test(space) || !FROM_RE.test(from)) return null;
    return Effect.gen(function* () {
      const db = yield* DbClientEffect;
      const today = todayStr();
      yield* tryOrFail('记录引流埋点', () =>
        db.groupStatDaily.upsert({
          where: { date_space_from: { date: today, space, from } },
          create: {
            date: today,
            space,
            from,
            imgPv: kind === 'imgPv' ? 1 : 0,
            pagePv: kind === 'pagePv' ? 1 : 0,
            pageUv: kind === 'pageUv' ? 1 : 0,
          },
          update:
            kind === 'imgPv'
              ? { imgPv: { increment: 1 } }
              : kind === 'pagePv'
                ? { pagePv: { increment: 1 } }
                : { pageUv: { increment: 1 } },
        }),
      );
    });
  },

  /** 引流统计：近 N 天按 空间+来源 聚合（date 倒序） */
  getStats(days: number): Effect.Effect<
    {
      days: number;
      items: { date: string; space: string; from: string; imgPv: number; pagePv: number; pageUv: number }[];
    },
    Error,
    AppConfigService
  > {
    return Effect.gen(function* () {
      const clampedDays = Math.min(Math.max(Math.trunc(days) || 30, 1), 365);
      const db = yield* DbClientEffect;
      /** since 日期字符串（本地时区 YYYY-MM-DD），与 stat_daily 主键粒度一致 */
      const sinceDate = (() => {
        const d = new Date(Date.now() - clampedDays * 24 * MS_PER_HOUR);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      })();
      const items = yield* tryOrFail('查询引流统计', () =>
        db.groupStatDaily.findMany({
          where: { date: { gte: sinceDate } },
          orderBy: [{ date: 'desc' }, { space: 'asc' }, { from: 'asc' }],
        }),
      );
      return {
        days: clampedDays,
        items: items.map((i) => ({
          date: i.date,
          space: i.space,
          from: i.from,
          imgPv: i.imgPv,
          pagePv: i.pagePv,
          pageUv: i.pageUv,
        })),
      };
    });
  },

  /**
   * 上传成功后的回调通知（server酱/bark，GET 一次）。返回 Effect 由调用方 provide AppConfigService 并 runFork（失败仅记日志）
   * @param spaceName 空间名称
   * @param groupName 可选分组名
   */
  notifyUpload(spaceName: string, groupName?: string): Effect.Effect<void, MsgError, AppConfigService> {
    return Effect.gen(function* () {
      const { groupEntry } = yield* AppConfigService;
      if (!groupEntry?.notifyUrl) return;
      const url = new URL(groupEntry.notifyUrl);
      url.searchParams.set(
        'title',
        encodeURIComponent(`群码已更新: ${spaceName}${groupName ? `（${groupName}）` : ''}`),
      );
      yield* tryOrFail('发送上传回执通知', () => fetch(url, { signal: AbortSignal.timeout(10_000) }));
      console.log(`${LOG_PREFIX} 上传回执通知已发送: ${spaceName}`);
    });
  },

  /** 读取群码图片流（动态图接口用） */
  openQrStream(absPath: string) {
    return createReadStream(absPath);
  },
};
