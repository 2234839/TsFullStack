import { Effect } from 'effect';
import { ModelMeta, modelsName } from '../db/model-meta';
import type { PrismaClient } from '@zenstackhq/runtime';
import { AuthService } from '../service';

export const apis = {
  system: {
    getModelMeta() {
      return ModelMeta;
    },
  },
  // 直接获取数据库 db 操作对象,这个函数仅用于给 Effect 提供类型提示，实际不应使用， server/index.ts 中会覆盖此变量交给用户，覆盖之后的类型参考下面的  API 类型
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
export type API = Omit<typeof apis, 'db'> & { db: safePrisma };
