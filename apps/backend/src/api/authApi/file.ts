import { File as FileModel, StorageType } from '@zenstackhq/runtime/models';
import { Effect } from 'effect';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, unlink } from 'fs/promises';
import { join } from 'path/posix';
import { v7 as uuidv7 } from 'uuid';
import { AppConfigContext } from '../../Context/AppConfig';
import { AuthContext } from '../../Context/Auth';
import { FileAccessService } from '../../Context/FileAccessService';
import { FilePathService } from '../../Context/FilePathService';
import { ReqCtxService } from '../../Context/ReqCtx';
import { MsgError } from '../../util/error';

export const fileApi = {
  /** file 这种二进制对象传递比较特殊，使用 superJSON 的话会大幅增加请求大小，并且如果不是流式读写的话也会导致内存占用过高
   * 所以这里打破常规，直接从 req 对象获取文件流并写入存储流（我没有想到更好的解决方案）
   */
  upload(_file: File) {
    return Effect.gen(function* () {
      const auth = yield* AuthContext;
      const fileId = uuidv7();
      const appConfig = yield* AppConfigContext;

      const reqCtx = yield* ReqCtxService;

      // 生成安全的用户专属文件路径
      const filePath = FilePathService.generateUserFilePath(
        auth.user.id,
        fileId,
        appConfig.uploadDir,
      );

      /** 确保用户目录存在 */
      yield* Effect.promise(() =>
        mkdir(join(appConfig.uploadDir, auth.user.id), { recursive: true }),
      );

      /**  获取文件流并写入文件流 */

      const reqFile = yield* Effect.promise(() =>
        // @ts-nocheck
        reqCtx.req.file(),
      );
      if (!reqFile) throw MsgError.msg('No file uploaded');
      const fileStream = reqFile.file;

      /** 统计文件大小 */
      let fileSize = 0;
      reqFile.file.on('data', (chunk) => {
        fileSize += chunk.length;
      });
      const writeStream = createWriteStream(filePath);
      fileStream.pipe(writeStream);
      yield* Effect.promise(async () => {
        await new Promise((resolve, reject) => {
          writeStream.on('finish', () => {
            resolve(1);
          });
          writeStream.on('error', (error) => {
            console.log('Write stream error:', error);
            reject(error);
          });
          // 也要监听读取流的错误
          reqFile.file.on('error', (error) => {
            console.log('Read stream error:', error);
            reject(error);
          });
        });
      });

      const res = yield* Effect.promise(() =>
        auth.db.file.create({
          data: {
            filename: FilePathService.sanitizeFilename(reqFile.filename),
            mimetype: reqFile.mimetype,
            path: fileId, // 存储相对路径中的文件ID部分
            size: fileSize,
            storageType: StorageType.LOCAL,
            authorId: auth.user.id,
          },
        }),
      );

      return res;
    });
  },
  /** 这里同样是为了解决非流式传递导致的内存占用过大问题
   * 通过 FileWarpItem 包装文件路径，http server 层再直接通过路径将文件流式传输给客户端
   * 这样可以避免将整个文件加载到内存中
   */
  file(id: FileModel['id']) {
    return Effect.gen(function* () {
      const auth = yield* AuthContext;

      const fileRow = yield* Effect.promise(() =>
        auth.db.file.findUnique({
          where: {
            id,
          },
        }),
      );
      if(!fileRow) throw MsgError.msg('file no found')
      // 使用文件访问服务验证权限并获取安全路径
      const fileWarpItem = yield* FileAccessService.createFileWarpItemEffect(fileRow, {
        checkOwnership: true,
        userId: auth.user.id,
        publicOnly: false,
      });

      return fileWarpItem as unknown as File;
    });
  },
  /** 移除本地文件以及数据库记录 */
  delete(id: FileModel['id']) {
    return Effect.gen(function* () {
      const auth = yield* AuthContext;

      const fileRow = yield* Effect.promise(() =>
        auth.db.file.findUnique({
          where: {
            id,
          },
        }),
      );

      // 验证文件存在性和所有权
      if (!fileRow) {
        throw MsgError.msg('File not found');
      }

      // 只有文件所有者才能删除文件
      if (fileRow.authorId !== auth.user.id) {
        throw MsgError.msg('Access denied: File ownership verification failed');
      }

      // 使用文件访问服务获取安全路径
      const { validatedPath } = yield* FileAccessService.validateFileAccessEffect(fileRow, {
        checkOwnership: true,
        userId: auth.user.id,
        publicOnly: false,
      });

      yield* Effect.promise(() =>
        unlink(validatedPath).catch((e) => {
          throw MsgError.msg('删除文件失败' + e);
        }),
      );

      // 删除数据库记录
      yield* Effect.promise(() =>
        auth.db.file.delete({
          where: {
            id,
          },
        }),
      );
    });
  },
};

export class FileWarpItem {
  constructor(public path: string, public model: FileModel) {}
  public getFileSteam() {
    const readStream = createReadStream(this.path);
    return readStream;
  }
}
