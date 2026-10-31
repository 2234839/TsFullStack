import { Effect } from 'effect';
import { AppConfigService } from '../../Context/AppConfig';
import { requireAdmin } from '../../Context/Auth';
import { ReqCtxService } from '../../Context/ReqCtx';
import { extractErrorMessage } from '../../util/error';
import { GroupEntryService, GROUP_QR_TTL_DAYS, MAX_QR_UPLOAD_BYTES } from '../../services/GroupEntryService';
import { fail, tryOrFail } from '../../util/error';
import { MAX_PAGE_SIZE } from '../../util/dbEffect';
import { DbClientEffect } from '../../Context/DbService';

/** 读取当前 RPC 请求中的 multipart 图片 */
function readMultipartImage() {
  return Effect.gen(function* () {
    const reqCtx = yield* ReqCtxService;
    const file = yield* tryOrFail('获取图片', () => reqCtx.req.file({ limits: { fileSize: MAX_QR_UPLOAD_BYTES } }));
    if (!file) return yield* fail('缺少图片');
    const buffer = yield* tryOrFail('读取图片', () => file.toBuffer());
    return { buffer, mime: file.mimetype };
  });
}

/** 私域引流管理接口：空间 → 公众号引导 + 群码池，来源用链接 ?from= 参数记录，全部要求管理员角色 */
export const groupEntryApi = {
  /** 空间主视图：公众号引导 + 群码池 */
  listSpaces() {
    return Effect.gen(function* () {
      yield* requireAdmin();
      return yield* GroupEntryService.listSpaces();
    });
  },

  /** 创建私域空间 */
  createSpace(name: string, displayName?: string) {
    return Effect.gen(function* () {
      yield* requireAdmin();
      return yield* GroupEntryService.createSpace({ name, displayName });
    });
  },

  /** 删除空间及其群码记录 */
  deleteSpace(id: number) {
    return Effect.gen(function* () {
      yield* requireAdmin();
      return yield* GroupEntryService.deleteSpace(id);
    });
  },

  /** 标记群已满、手动下线或重新启用 */
  setQrStatus(id: number, status: 'FULL' | 'ARCHIVED' | 'ACTIVE') {
    return Effect.gen(function* () {
      yield* requireAdmin();
      return yield* GroupEntryService.setQrStatus(id, status);
    });
  },

  /** 群码元信息（有效期等，供管理页展示） */
  getSettings() {
    return Effect.gen(function* () {
      yield* requireAdmin();
      return {
        groupQr: { kind: 'WECHAT_GROUP', ttlDays: GROUP_QR_TTL_DAYS },
      };
    });
  },

  /** 保存空间的公众号名称、回复关键词和引导语 */
  updateOfficialAccount(spaceId: number, name: string, replyKeyword?: string, guideText?: string) {
    return Effect.gen(function* () {
      yield* requireAdmin();
      return yield* GroupEntryService.updateOfficialAccount(spaceId, { name, replyKeyword, guideText });
    });
  },

  /** 上传空间的公众号二维码 */
  uploadOfficialQr(_file: File, spaceId: number) {
    return Effect.gen(function* () {
      yield* requireAdmin();
      const image = yield* readMultipartImage();
      return yield* GroupEntryService.uploadOfficialQr({ spaceId, ...image });
    });
  },

  /** 上传群码到空间池 */
  upload(_file: File, spaceId: number, groupName?: string, note?: string) {
    return Effect.gen(function* () {
      yield* requireAdmin();
      const image = yield* readMultipartImage();
      const created = yield* GroupEntryService.uploadQr({ spaceId, groupName, note, ...image });
      const reqCtx = yield* ReqCtxService;
      reqCtx.log('[GroupEntryApi] 管理员上传群码', spaceId, created.id);
      const appConfig = yield* AppConfigService;
      /** 上传回执通知 fire-and-forget：失败仅记日志，不阻塞上传响应 */
      Effect.runFork(
        GroupEntryService.notifyUpload(String(spaceId), groupName).pipe(
          Effect.provideService(AppConfigService, appConfig),
          Effect.catch((e) => Effect.logWarning(`[GroupEntryApi] 上传回执通知失败（忽略）: ${extractErrorMessage(e)}`)),
        ),
      );
      return created;
    });
  },

  /** 按日、按 空间+来源 查询引流统计 */
  getStats(days: number) {
    return Effect.gen(function* () {
      yield* requireAdmin();
      return yield* GroupEntryService.getStats(days);
    });
  },

  /** 空间操作员列表（带账号信息；spaceId 为空查全部） */
  listOperators(spaceId?: number) {
    return Effect.gen(function* () {
      yield* requireAdmin();
      const db = yield* DbClientEffect;
      return yield* tryOrFail('查询空间操作员', () =>
        db.groupSpaceOperator.findMany({
          where: spaceId ? { spaceId } : undefined,
          include: {
            space: { select: { name: true } },
            user: { select: { email: true, nickname: true } },
          },
          orderBy: [{ spaceId: 'asc' }, { id: 'asc' }],
        }),
      );
    });
  },

  /** 添加空间操作员（按账号 ID，可见范围由前端用户选择器按权限过滤） */
  addOperator(userId: string, spaceId: number) {
    return Effect.gen(function* () {
      yield* requireAdmin();
      const db = yield* DbClientEffect;
      const user = yield* tryOrFail('查询账号', () => db.user.findUnique({ where: { id: userId } }));
      if (!user) return yield* fail(`账号不存在: ${userId}`);
      const space = yield* tryOrFail('查询空间', () => db.groupSpace.findUnique({ where: { id: spaceId } }));
      if (!space) return yield* fail(`空间不存在: ${spaceId}`);
      const existing = yield* tryOrFail('查询已有授权', () =>
        db.groupSpaceOperator.findFirst({ where: { userId: user.id, spaceId } }),
      );
      if (existing) return yield* fail('该账号已被授权管理此空间');
      const created = yield* tryOrFail('添加空间操作员', () =>
        db.groupSpaceOperator.create({ data: { userId: user.id, spaceId } }),
      );
      const reqCtx = yield* ReqCtxService;
      reqCtx.log(`[GroupEntryApi] 授权 ${user.email} 管理空间 ${space.name}`);
      return { id: created.id };
    });
  },

  /** 移除空间操作员授权 */
  removeOperator(id: number) {
    return Effect.gen(function* () {
      yield* requireAdmin();
      const db = yield* DbClientEffect;
      yield* tryOrFail('移除空间操作员', () => db.groupSpaceOperator.deleteMany({ where: { id } }));
      return { success: true as const };
    });
  },

  /** 渠道消息列表（管理员看全部，倒序分页） */
  listChannelMessages(limit: number, beforeId?: number) {
    return Effect.gen(function* () {
      yield* requireAdmin();
      const db = yield* DbClientEffect;
      return yield* tryOrFail('查询渠道消息', () =>
        db.channelMessage.findMany({
          where: beforeId ? { id: { lt: beforeId } } : undefined,
          include: { user: { select: { email: true, nickname: true } } },
          orderBy: { id: 'desc' },
          take: Math.min(Math.max(limit, 1), MAX_PAGE_SIZE),
        }),
      );
    });
  },
};
