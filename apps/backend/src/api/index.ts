import { Effect } from 'effect';
import { ModelMeta, modelsName } from '../db/model-meta';
import type { PrismaClient } from '@zenstackhq/runtime';

export const apis = {
  system: {
    getModelMeta() {
      return ModelMeta;
    },
  },
  /** 用于避免 Effect.isEffect 的判断之后得到 Effect<unknown, unknown, unknown> 导致类型系统失效*/
  __effect__() {
    return Effect.succeed('test');
  },
};

/** ZenStack 不接受 $transaction 数组形式的调用，客户端又没法使用非数组形式，所以不让用 */
const allowedMethods = modelsName;
export type safePrisma = Pick<PrismaClient, (typeof allowedMethods)[number]>;
export type API = typeof apis & { db: safePrisma };
