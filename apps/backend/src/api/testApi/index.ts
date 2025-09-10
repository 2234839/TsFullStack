import { Effect } from 'effect';

let id = 0;
/** 实验测试功能 */
export const testApi = {
  并发控制() {
    return Effect.gen(function* () {
      yield* Effect.sleep('1 seconds');
      return { status: 'completed', id: id++, time: new Date().toISOString() };
    });
  },
};
