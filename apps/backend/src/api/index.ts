import type { PrismaClient } from '@zenstackhq/runtime';
import { Effect } from 'effect';
import type { allowedMethods } from '../Context/PrismaService';
import { AuthContext } from '../Context/Auth';
import { systemApis } from './systemApis';
import { testApi } from './testApi';
import { fileApi } from './authApi/file';
import { aiApi } from './AiApi';
import { moduleApis } from './moduleApi';

export const apis = {
  // 这里的 as 是为了解决导出 lib 包后会存在的一些类型问题 https://shenzilong.cn/index/ts%20%E5%B5%8C%E5%A5%97%E5%8C%85%E5%AF%BC%E5%87%BA%E7%B1%BB%E5%9E%8B%E4%B8%BA%20any%20%E7%9A%84%E9%97%AE%E9%A2%98.html#20250926083301-jptx0f6
  moduleApis: moduleApis as typeof import('@tsfullstack/module-autoload/api').api,
  system: systemApis,
  testApi,
  fileApi,
  aiApi,
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
