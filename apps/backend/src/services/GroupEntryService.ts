import { Effect } from 'effect';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname, resolve, sep } from 'path';
import { createReadStream } from 'fs';
import { v7 as uuidv7 } from 'uuid';
import { DbClientEffect } from '../Context/DbService';
import { AppConfigService, type AppConfig } from '../Context/AppConfig';
import { fail, tryOrFail, MsgError, extractErrorMessage } from '../util/error';
import { MS_PER_HOUR } from '../util/constants';
import type { GroupQRCode } from '../../.zenstack/models';

/** 日志前缀 */
const LOG_PREFIX = '[GroupEntry]';

/** 微信群码有效期：7 天 */
const QR_TTL_MS = 7 * 24 * MS_PER_HOUR;

/** 到期提前量：5 分钟（宁早勿晚，用户扫到过期码体验最差） */
const EXPIRY_EARLY_MS = 5 * 60 * 1000;

/** 统计表当日日期字符串（本地时区，YYYY-MM-DD） */
function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 允许上传的图片 MIME 白名单 */
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** 上传大小上限 5MB */
const MAX_QR_UPLOAD_BYTES = 5 * 1024 * 1024;

/** 群码存储子目录（相对 uploadDir） */
const QR_SUBDIR = 'group-entry';

/** 入口标识白名单正则（小写字母/数字/连字符，防路径注入与怪异 entry） */
const ENTRY_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** 校验入口标识格式，非法直接失败 */
function assertEntry(entry: string): Effect.Effect<void, MsgError> {
  if (!ENTRY_RE.test(entry)) {
    return Effect.fail(MsgError.msg(`非法入口标识: ${entry}`));
  }
  return Effect.succeed(undefined);
}

/** 群码是否仍有效（按 expiresAt - 5min 惰性计算，无定时任务） */
export function isQrEffective(qr: Pick<GroupQRCode, 'status' | 'expiresAt'>): boolean {
  return qr.status === 'ACTIVE' && qr.expiresAt.getTime() - EXPIRY_EARLY_MS > Date.now();
}

/** 出口视图：管理列表项（不暴露 imagePath 原始路径） */
export type GroupQRCodeView = Omit<GroupQRCode, 'imagePath'>;

function toView(qr: GroupQRCode): GroupQRCodeView {
  const { imagePath: _hidden, ...view } = qr;
  return view;
}

/**
 * 私域引流服务
 *
 * 事件驱动维护模型：群码过期 → 提示关注公众号 → 博主收到催更 → 上传新码（即时生效）。
 * 没有人进群 = 永远零维护，无 cron、无轮询，过期判断全部请求时惰性计算。
 */
export const GroupEntryService = {
  /** 查询某入口当前生效的群码（含图片绝对路径，仅服务端内部使用，不外泄） */
  getActiveQr(entry: string): Effect.Effect<{ qr: GroupQRCode; absPath: string } | null, Error, AppConfigService> {
    return Effect.gen(function* () {
      yield* assertEntry(entry);
      const db = yield* DbClientEffect;
      const qr = yield* tryOrFail('查询生效群码', () =>
        db.groupQRCode.findFirst({
          where: { entry, status: 'ACTIVE' },
          orderBy: { uploadedAt: 'desc' },
        }),
      );
      if (!qr || !isQrEffective(qr)) return null;

      const { uploadDir } = yield* AppConfigService;
      /** imagePath 是受控生成的相对路径（uploadDir/group-entry/<uuid>.<ext>），join 后再做一次边界校验 */
      const absPath = resolve(uploadDir, qr.imagePath);
      const base = resolve(uploadDir);
      if (!absPath.startsWith(base + sep)) {
        return yield* fail(`群码图片路径越界: ${qr.imagePath}`);
      }
      return { qr, absPath };
    });
  },

  /**
   * 上传新群码（上传时刻即生效时刻）：同 entry 旧 ACTIVE 码自动转 ARCHIVED
   * @param entry 入口标识
   * @param groupName 群名（备注）
   * @param note 博主备注
   * @param buffer 图片二进制
   * @param mime MIME 类型
   */
  uploadQr(options: {
    entry: string;
    groupName?: string;
    note?: string;
    buffer: Buffer;
    mime: string;
  }): Effect.Effect<GroupQRCodeView, Error, AppConfigService> {
    return Effect.gen(function* () {
      yield* assertEntry(options.entry);
      if (!ALLOWED_MIME.has(options.mime)) {
        return yield* fail(`不支持的图片类型: ${options.mime}（仅 png/jpeg/webp）`);
      }
      if (options.buffer.length === 0 || options.buffer.length > MAX_QR_UPLOAD_BYTES) {
        return yield* fail(`图片大小须在 1B ~ 5MB 之间，当前 ${options.buffer.length} 字节`);
      }

      const db = yield* DbClientEffect;
      const { uploadDir } = yield* AppConfigService;

      /** 先落盘（uuid 文件名，不用用户文件名，杜绝路径注入） */
      const ext = options.mime === 'image/png' ? 'png' : options.mime === 'image/webp' ? 'webp' : 'jpg';
      const relPath = join(QR_SUBDIR, `${uuidv7()}.${ext}`);
      const absPath = join(uploadDir, relPath);
      yield* tryOrFail('创建群码目录', () => mkdir(dirname(absPath), { recursive: true }));
      yield* tryOrFail('写入群码图片', () => writeFile(absPath, options.buffer));

      const now = new Date();
      const created = yield* tryOrFail('创建群码记录', () =>
        db.groupQRCode.create({
          data: {
            entry: options.entry,
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

      /** 同入口旧 ACTIVE 码 → ARCHIVED（事务外尽力而为：上一个码已不可能再被选中——查询按 uploadedAt desc） */
      yield* tryOrFail('归档旧码', () =>
        db.groupQRCode.updateMany({
          where: { entry: options.entry, status: 'ACTIVE', id: { not: created.id } },
          data: { status: 'ARCHIVED' },
        }),
      );

      console.log(
        `${LOG_PREFIX} 入口 ${options.entry} 新群码已生效: id=${created.id}, 过期于 ${created.expiresAt.toISOString()}`,
      );
      return toView(created);
    });
  },

  /** 手动下线某码（群满 100 人换码场景，等价过期） */
  archiveQr(id: number): Effect.Effect<{ success: true }, Error, AppConfigService> {
    return Effect.gen(function* () {
      const db = yield* DbClientEffect;
      const updated = yield* tryOrFail('下线群码', () =>
        db.groupQRCode.update({
          where: { id },
          data: { status: 'ARCHIVED' },
        }),
      );
      console.log(`${LOG_PREFIX} 群码 id=${id}（entry=${updated.entry}）已手动下线`);
      return { success: true as const };
    });
  },

  /** 列出群码池（全部入口，按上传时间倒序；不暴露 imagePath） */
  listQrs(): Effect.Effect<GroupQRCodeView[], Error, AppConfigService> {
    return Effect.gen(function* () {
      const db = yield* DbClientEffect;
      const list = yield* tryOrFail('查询群码池', () => db.groupQRCode.findMany({ orderBy: { uploadedAt: 'desc' } }));
      return list.map(toView);
    });
  },

  /**
   * 引流埋点（fire-and-forget）：upsert 当日计数，失败仅记日志不影响响应
   * @param entry 入口标识
   * @param appConfig 应用配置（DbClientEffect 的运行依赖）
   * @param kind 埋点类型：imgPv（动态图）/ pagePv（落地页）/ pageUv（落地页当日新 cookie）
   */
  recordStat(entry: string, appConfig: AppConfig, kind: 'imgPv' | 'pagePv' | 'pageUv'): void {
    if (!ENTRY_RE.test(entry)) return;
    Effect.runPromise(
      Effect.gen(function* () {
        const db = yield* DbClientEffect;
        const today = todayStr();
        yield* tryOrFail('记录引流埋点', () =>
          db.groupStatDaily.upsert({
            where: { date_entry: { date: today, entry } },
            create: {
              date: today,
              entry,
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
      }).pipe(Effect.provideService(AppConfigService, appConfig)),
    ).catch((e) => console.error(`${LOG_PREFIX} 埋点失败（不影响响应）:`, extractErrorMessage(e)));
  },
  /** 引流统计：近 N 天按入口聚合（date 倒序） */
  getStats(days: number): Effect.Effect<
    {
      days: number;
      items: { date: string; entry: string; imgPv: number; pagePv: number; pageUv: number }[];
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
          orderBy: [{ date: 'desc' }, { entry: 'asc' }],
        }),
      );
      return {
        days: clampedDays,
        items: items.map((i) => ({
          date: i.date,
          entry: i.entry,
          imgPv: i.imgPv,
          pagePv: i.pagePv,
          pageUv: i.pageUv,
        })),
      };
    });
  },

  /**
   * 上传成功后的回调通知（server酱/bark，GET 一次，失败仅记日志）
   * @param appConfig 应用配置（读取 notifyUrl）
   */
  notifyUpload(appConfig: AppConfig, entry: string, groupName?: string): void {
    Effect.runPromise(
      Effect.gen(function* () {
        const { groupEntry } = yield* AppConfigService;
        if (!groupEntry?.notifyUrl) return;
        const url = new URL(groupEntry.notifyUrl);
        url.searchParams.set('title', encodeURIComponent(`群码已更新: ${entry}${groupName ? `（${groupName}）` : ''}`));
        yield* tryOrFail('发送上传回执通知', () => fetch(url, { signal: AbortSignal.timeout(10_000) }));
        console.log(`${LOG_PREFIX} 上传回执通知已发送: ${entry}`);
      }).pipe(Effect.provideService(AppConfigService, appConfig)),
    ).catch((e) => console.error(`${LOG_PREFIX} 回执通知失败（忽略）:`, extractErrorMessage(e)));
  },

  /** 读取群码图片流（动态图接口用） */
  openQrStream(absPath: string) {
    return createReadStream(absPath);
  },
};
