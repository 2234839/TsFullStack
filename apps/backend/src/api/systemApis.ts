import { Effect } from 'effect';
import { ModelMeta } from '../db/model-meta';
import { AuthService } from '../service/Auth';
import { File as FileModel, StorageType } from '@zenstackhq/runtime/models';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path/posix';
import { v7 as uuidv7 } from 'uuid';
import { MsgError } from '../util/error';
import { AppConfigService } from '../service/AppConfigService';

export const systemApis = {
  getModelMeta() {
    return ModelMeta;
  },
  /** file 这种二进制对象传递比较特殊，使用 superJSON 的话会大幅增加请求大小，所以在数据传输层做了特殊处理，这里也只能接受一个参数 */
  upload(file: File) {
    return Effect.gen(function* () {
      const auth = yield* AuthService;
      const fileId = uuidv7();
      const appConfig = yield* AppConfigService;
      const filePath = join(appConfig.uploadDir, fileId);
      const arrayBuffer = yield* Effect.promise(() => file.arrayBuffer());
      const buffer = Buffer.from(arrayBuffer);
      yield* Effect.promise(() => writeFile(filePath, buffer));

      const res = yield* Effect.promise(() =>
        auth.db.file.create({
          data: {
            filename: file.name,
            mimetype: file.type,
            path: filePath,
            size: file.size, // 文件大小
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
          throw MsgError.msg('读取文件失败');
        }),
      );
      const file = new File([fileBuffer], fileRow.filename);
      return file;
    });
  },
};
