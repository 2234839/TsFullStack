import { Effect } from 'effect';
import { AppConfigService } from '../../Context/AppConfig';
import { requireAdmin } from '../../Context/Auth';
import { ReqCtxService } from '../../Context/ReqCtx';
import { GroupEntryService, GROUP_QR_TTL_DAYS, MAX_QR_UPLOAD_BYTES } from '../../services/GroupEntryService';
import { fail, tryOrFail } from '../../util/error';

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
    return requireAdmin().pipe(Effect.andThen(GroupEntryService.listSpaces()));
  },

  /** 创建私域空间 */
  createSpace(name: string, displayName?: string) {
    return requireAdmin().pipe(Effect.andThen(GroupEntryService.createSpace({ name, displayName })));
  },

  /** 删除空间及其群码记录 */
  deleteSpace(id: number) {
    return requireAdmin().pipe(Effect.andThen(GroupEntryService.deleteSpace(id)));
  },

  /** 标记群已满、手动下线或重新启用 */
  setQrStatus(id: number, status: 'FULL' | 'ARCHIVED' | 'ACTIVE') {
    return requireAdmin().pipe(Effect.andThen(GroupEntryService.setQrStatus(id, status)));
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
    return requireAdmin().pipe(
      Effect.andThen(GroupEntryService.updateOfficialAccount(spaceId, { name, replyKeyword, guideText })),
    );
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
      GroupEntryService.notifyUpload(appConfig, String(spaceId), groupName);
      return created;
    });
  },

  /** 按日、按 空间+来源 查询引流统计 */
  getStats(days: number) {
    return requireAdmin().pipe(Effect.andThen(GroupEntryService.getStats(days)));
  },
};
