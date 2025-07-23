import { Effect } from 'effect';
import { AuthService } from '../../service/Auth';
import { File as FileModel, StorageType } from '@zenstackhq/runtime/models';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path/posix';
import { v7 as uuidv7 } from 'uuid';
import { MsgError } from '../../util/error';
import { AppConfigService } from '../../service/AppConfigService';
import { ReqCtxService } from '../../service/ReqCtx';
import { createWriteStream } from 'fs';

export const fileApi = {
  /** file 这种二进制对象传递比较特殊，使用 superJSON 的话会大幅增加请求大小，并且如果不是流式读写的话也会导致内存占用过高
   * 所以这里打破常规，直接从 req 对象获取文件内容并存储（我没有想到更好的解决方案）
   */
  upload(_file: File) {
    return Effect.gen(function* () {
      const auth = yield* AuthService;
      const fileId = uuidv7();
      const appConfig = yield* AppConfigService;

      const reqCtx = yield* ReqCtxService;

      const filePath = join(appConfig.uploadDir, fileId);

      /** 获取文件流并写入文件流 */
      const reqFile = yield* Effect.promise(() => reqCtx.req.file());
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
            filename: reqFile.filename,
            mimetype: reqFile.mimetype,
            path: filePath,
            size: fileSize,
            storageType: StorageType.LOCAL,
            authorId: auth.user.id,
          },
        }),
      );

      return res;
    });
  },
  file(id: FileModel['id']) {
    return Effect.gen(function* () {
      const auth = yield* AuthService;

      const fileRow = yield* Effect.promise(() =>
        auth.db.file.findUnique({
          where: {
            id,
          },
        }),
      );
      if (!fileRow) {
        throw MsgError.msg('File not found');
      }
      // 读取文件内容
      const filePath = fileRow?.path;
      const fileBuffer = yield* Effect.promise(() =>
        readFile(filePath).catch((e) => {
          throw MsgError.msg('读取文件失败' + e);
        }),
      );
      const file = new File([fileBuffer], fileRow.filename, {
        type: fileRow.mimetype,
        lastModified: fileRow.updated.getTime(),
      });
      return file;
    });
  },
  /** 移除本地文件以及数据库记录 */
  delete(id: FileModel['id']) {
    return Effect.gen(function* () {
      const auth = yield* AuthService;

      const fileRow = yield* Effect.promise(() =>
        auth.db.file.findUnique({
          where: {
            id,
          },
        }),
      );
      if (!fileRow) {
        throw MsgError.msg('File not found');
      }
      // 删除文件
      const filePath = fileRow?.path;
      yield* Effect.promise(() =>
        unlink(filePath).catch((e) => {
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
