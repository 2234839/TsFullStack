import { Effect } from 'effect';
import { ModelMeta } from '../db/model-meta';
import { AuthService } from '../service';
import { File as FileModel, StorageType } from '@zenstackhq/runtime/models';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path/posix';
import { v7 as uuidv7 } from 'uuid';
import { AppConfig } from '../config';
import { MsgError } from '../util/error';

export const systemApis = {
  getModelMeta() {
    return ModelMeta;
  },
  /** file 这种二进制对象传递比较特殊，使用 super jons 的话会大幅增加请求大小，所以在数据传输层做了特殊处理，这里也只能接受一个参数 */
  upload(file: File) {
    return Effect.gen(function* () {
      const auth = yield* AuthService;
      const fileId = uuidv7();
      const filePath = join(AppConfig.uploadDir, fileId);
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
        throw new MsgError(MsgError.op_msgError, 'File not found');
      }
      // 读取文件内容
      const filePath = fileRow?.path;
      const fileBuffer = yield* Effect.promise(() =>
        readFile(filePath).catch((e) => {
          throw new MsgError(MsgError.op_msgError, '读取文件失败');
        }),
      );
      console.log('[filePath]', filePath);
      const file = new File([fileBuffer], fileRow.filename);
      return file;
    });
  },
};
