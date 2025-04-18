import type { PrismaClient } from '@zenstackhq/runtime';
import { File as FileModel, StorageType } from '@zenstackhq/runtime/models';
import { Effect } from 'effect';
import { writeFile } from 'fs/promises';
import { join } from 'path/posix';
import { v7 as uuidv7 } from 'uuid';
import { AppConfig } from '../config';
import type { allowedMethods } from '../db';
import { ModelMeta } from '../db/model-meta';
import { AuthService } from '../service';
import { MsgError } from '../util/error';
export const apis = {
  system: {
    getModelMeta() {
      return ModelMeta;
    },
    /** file 这种二进制对象传递比较特殊，使用 super jons 的话会大幅增加请求大小，所以在数据传输层做了特殊处理，这里也只能接受一个参数 */
    upload(file: File) {
      return Effect.gen(function* () {
        const auth = yield* AuthService;
        const fileId = uuidv7();
        const filePath = join(AppConfig.uploadDir, fileId);
        const arrayBuffer = yield* Effect.tryPromise(() => file.arrayBuffer());
        const buffer = Buffer.from(arrayBuffer);
        yield* Effect.tryPromise(() => writeFile(filePath, buffer));

        const res = yield* Effect.tryPromise(() =>
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

        const file = yield* Effect.tryPromise(() =>
          auth.db.file.findUnique({
            where: {
              id,
            },
          }),
        );
        if (!file) {
          throw new MsgError(MsgError.op_msgError, 'File not found');
        }
        // 读取文件内容
        const filePath = file?.path;
        // readFile(filePath);
        return filePath;
      });
    },
  },
  // 直接获取数据库 db 操作对象,这个函数仅用于给 Effect 提供 apis 依赖 AuthService 的类型提示 ， server/index.ts 中会覆盖此变量交给用户，覆盖之后的类型参考下面的  API 类型
  db() {
    return Effect.gen(function* () {
      const auth = yield* AuthService;
      return auth.db;
    });
  },
  /** 用于避免 Effect.isEffect 的判断之后得到 Effect<unknown, unknown, unknown> 导致类型系统失效*/
  __effect__() {
    return Effect.succeed('test');
  },
};

export type safePrisma = Pick<PrismaClient, (typeof allowedMethods)[number]>;
export type APIRaw = typeof apis;
export type API = Omit<APIRaw, 'db'> & { db: safePrisma };
