import type { PrismaClient } from '@zenstackhq/runtime';
import { Effect } from 'effect';
import type { allowedMethods } from '../Context/PrismaService';
import { AuthContext } from '../Context/Auth';
import { systemApis } from './systemApis';
import { testApi } from './testApi';
import { fileApi } from './authApi/file';

export const apis = {
  system: systemApis,
  testApi,
  fileApi,
  // 直接获取数据库 db 操作对象,这个函数仅用于给 Effect 提供 apis 依赖 AuthContext 的类型提示 ， server/index.ts 中会覆盖此变量交给用户，覆盖之后的类型参考下面的  API 类型
  db() {
    return Effect.gen(function* () {
      const auth = yield* AuthContext;
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
