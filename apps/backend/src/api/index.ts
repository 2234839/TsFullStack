import { Effect } from 'effect';
import { ModelMeta, modelsName } from '../db/model-meta';
import type { PrismaClient } from '@zenstackhq/runtime';
import {} from '@zenstackhq/runtime';
import { AuthService } from '../service';
import { join } from 'path/posix';
import { v7 as uuidv7 } from 'uuid';
import { writeFile } from 'fs/promises';
import { StorageType } from '@zenstackhq/runtime/models';
export const apis = {
  system: {
    getModelMeta() {
      return ModelMeta;
    },
    /** file 这种二进制对象比较特殊，所以在数据传输层做了特殊处理，这里也只能接受一个参数 */
    async upload(file: File) {
      return Effect.gen(function* () {
        const auth = yield* AuthService;

        // 将文件保存到本地
        const fileId = uuidv7();
        const filePath = join('./uploads', fileId);
        // 将文件内容写入目标路径
        const arrayBuffer = yield* Effect.tryPromise(() => file.arrayBuffer());
        const buffer = Buffer.from(arrayBuffer);
        yield* Effect.tryPromise(() => writeFile(filePath, buffer));

        const res = yield* Effect.tryPromise(() =>
          auth.db.file.create({
            data: {
              filename: file.name,
              mimetype: '',
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

/** ZenStack 不接受 $transaction 数组形式的调用，客户端又没法使用非数组形式，所以不让用 */
const allowedMethods = modelsName;
export type safePrisma = Pick<PrismaClient, (typeof allowedMethods)[number]>;
export type APIRaw = typeof apis;
export type API = Omit<APIRaw, 'db'> & { db: safePrisma };
