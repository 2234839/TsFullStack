import { Effect } from 'effect';

/** 无需鉴权的 api */
export const appApis = {
  system: {
    login() {

    },
  },
  /** 用于避免 Effect.isEffect 的判断之后得到 Effect<unknown, unknown, unknown> 导致类型系统失效*/
  __effect__() {
    return Effect.succeed('test');
  },
};
export type AppAPI = typeof appApis;
