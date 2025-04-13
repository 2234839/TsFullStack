import { Effect } from 'effect';
import { ModelMeta } from '../db/model-meta';



export const apis = {
  a: {
    b(n: number) {
      return Effect.succeed((n + 2) as 3);
    },
    c(n: number) {
      return Effect.succeed((n + 2) as 3);
    },
  },
  b() {
    return 5 as const;
  },
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
export type API = typeof apis;
