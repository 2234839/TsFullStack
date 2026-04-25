import { File as FileModel, StorageType, FileStatusEnum } from '../../../.zenstack/models';
import { Effect } from 'effect';
import { fail, MsgError, requireOrFail, tryOrFail, extractErrorMessage } from '../../util/error';
import { createWriteStream } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path/posix';
import { v7 as uuidv7 } from 'uuid';
import { AppConfigService } from '../../Context/AppConfig';
import { MSG } from '../../util/constants';
import { AuthContext, authUserIsAdmin } from '../../Context/Auth';
import { FileAccessService } from '../../Context/FileAccessService';
import { FilePathService } from '../../Context/FilePathService';
import { ReqCtxService } from '../../Context/ReqCtx';
import { dbTry, dbTryOrDefault } from '../../util/dbEffect';

/** 日志前缀 */
const LOG_PREFIX = '[FileApi]';

/** 查询文件记录（统一 authApi/file.ts 中的重复查询模式） */
const fetchFileById = (id: FileModel['id']) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    return yield* dbTryOrDefault(LOG_PREFIX, '查询文件', () =>
      auth.db.file.findUnique({ where: { id } }),
      null,
    );
  });

/**
 * 通用文件保存函数（Buffer 一次性写入 / ReadableStream 流式写入）
 * 统一处理：生成 fileId → 确保目录 → 写入文件 → 创建 DB 记录
 *
 * @param source - Buffer（一次性写入）或 { stream, byteLength }（流式写入）
 */
const saveFile = (options: {
  filename: string;
  mimetype: string;
  /** Buffer 模式：直接传入完整数据 */
  buffer?: Buffer;
  /** 流式模式：传入可读流和已知大小（用于大文件/上传场景） */
  stream?: NodeJS.ReadableStream;
  byteLength?: number;
}) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    const appConfig = yield* AppConfigService;
    const fileId = uuidv7();

    const filePath = FilePathService.generateUserFilePath(auth.user.id, fileId, appConfig.uploadDir);

    yield* tryOrFail('创建目录', () => mkdir(join(appConfig.uploadDir, auth.user.id), { recursive: true }));

    if (options.buffer) {
      /** Buffer 模式：一次性写入（适合已在内存的数据，如 AI 图片下载） */
      yield* tryOrFail('写入文件', () => writeFile(filePath, options.buffer!));
    } else if (options.stream) {
      /** 流式模式：pipe 写入（适合大文件上传，避免内存暴涨） */
      let fileSize = options.byteLength ?? 0;
      const trackedStream = options.stream.on('data', (chunk: Buffer) => {
        if (!options.byteLength) fileSize += chunk.length;
      });
      const writeStream = createWriteStream(filePath);
      trackedStream.pipe(writeStream);
      yield* tryOrFail('写入文件', () => new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        trackedStream.on('error', reject);
      }));
      options.byteLength = fileSize;
    } else {
      return yield* fail(MSG.SAVE_FILE_NO_DATA);
    }

    return yield* dbTry(LOG_PREFIX, '创建文件记录', () =>
      auth.db.file.create({
        data: {
          filename: FilePathService.sanitizeFilename(options.filename),
          mimetype: options.mimetype,
          path: fileId,
          size: options.buffer?.length ?? options.byteLength ?? 0,
          storageType: StorageType.LOCAL,
          authorId: auth.user.id,
        },
      }),
    );
  });

/** 向后兼容别名：Buffer 模式的快捷方式 */
export const saveFileFromBuffer = (opts: Omit<Parameters<typeof saveFile>[0], 'stream' | 'byteLength'> & { buffer: Buffer }) =>
  saveFile(opts);

export const fileApi = {
  /** file 这种二进制对象传递比较特殊，使用 superJSON 的话会大幅增加请求大小，并且如果不是流式读写的话也会导致内存占用过高
   * 所以这里打破常规，直接从 req 对象获取文件流并写入存储流（我没有想到更好的解决方案）
   */
  upload(_file: File) {
    return Effect.gen(function* () {
      const reqCtx = yield* ReqCtxService;

      /** 获取上传文件 */
      const reqFile = yield* requireOrFail(
        yield* tryOrFail('获取上传文件', () => reqCtx.req.file() as Promise<{ file: NodeJS.ReadableStream; filename: string; mimetype: string } | null>),
        'No file uploaded',
      );

      reqCtx.log(`${LOG_PREFIX} 用户上传文件: ${reqFile.filename}, mimetype=${reqFile.mimetype}`);

      /** 复用 saveFile 的流式写入模式（统一路径生成、目录创建、DB 记录） */
      return yield* saveFile({
        filename: reqFile.filename,
        mimetype: reqFile.mimetype,
        stream: reqFile.file,
      });
    });
  },
  updateFileStatus(id: FileModel['id'], status: FileStatusEnum) {
    return Effect.gen(function* () {
      const auth = yield* AuthContext;

      const fileRow = yield* requireOrFail(yield* fetchFileById(id), MSG.FILE_NOT_FOUND);

      yield* FileAccessService.validateFileAccessEffect(fileRow, {
        checkOwnership: yield* checkOwnership(true),
        userId: auth.user.id,
        publicOnly: false,
      });

      const reqCtx = yield* ReqCtxService;
      reqCtx.log(`${LOG_PREFIX} 更新文件状态: id=${id}, status=${status}`);

      return yield* dbTry(LOG_PREFIX, '更新文件状态', () =>
        auth.db.file.update({
          where: { id },
          data: { status },
        }),
      );
    });
  },
  /** 这里同样是为了解决非流式传递导致的内存占用过大问题
   * 通过 FileWrapItem 包装文件路径，http server 层再直接通过路径将文件流式传输给客户端
   * 这样可以避免将整个文件加载到内存中
   */
  file(id: FileModel['id']) {
    return Effect.gen(function* () {
      const auth = yield* AuthContext;

      const fileRow = yield* requireOrFail(yield* fetchFileById(id), MSG.FILE_NOT_FOUND);
      // 使用文件访问服务验证权限并获取安全路径
      const fileWrapItem = yield* FileAccessService.createFileWrapItemEffect(fileRow, {
        checkOwnership: yield* checkOwnership(true),
        userId: auth.user.id,
        publicOnly: false,
      });

      /** FileWrapItem → File: http server 层通过 instanceof File 判断是否走流式传输 */
      return fileWrapItem as unknown as File;
    });
  },
  /** 移除本地文件以及数据库记录 */
  delete(id: FileModel['id']) {
    return Effect.gen(function* () {
      const auth = yield* AuthContext;
      const reqCtx = yield* ReqCtxService;

      const fileRow = yield* fetchFileById(id);

      // 如果文件不存在，直接返回成功（幂等性操作）
      if (!fileRow) {
        return;
      }

      // 使用文件访问服务获取安全路径并验证所有权
      const { validatedPath } = yield* FileAccessService.validateFileAccessEffect(fileRow, {
        checkOwnership: yield* checkOwnership(true),
        userId: auth.user.id,
        publicOnly: false,
      });

      /** 删除物理文件，如果文件不存在则忽略（ENOENT 视为成功，保证幂等性） */
      yield* Effect.tryPromise({
        try: () => unlink(validatedPath),
        catch: (e) => {
          if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
          return MsgError.msg(`删除物理文件失败: ${extractErrorMessage(e)}`);
        },
      });

      // 删除数据库记录
      yield* dbTry(LOG_PREFIX, '删除文件记录', () =>
        auth.db.file.delete({
          where: { id },
        }),
      );

      reqCtx.log(`${LOG_PREFIX} 删除文件: id=${id}, path=${validatedPath}`);
    });
  },
};

/** 对超级管理员进行特殊处理，超管无视 checkOwnership 校验  */
function checkOwnership(shouldCheck: boolean) {
  return Effect.gen(function* () {
    const isAdmin = yield* authUserIsAdmin();
    return !isAdmin && shouldCheck;
  });
}

/** FileWrapItem 已提取到 util/file-types.ts，所有消费者已直接导入 */
