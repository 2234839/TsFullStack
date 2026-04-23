import { Effect } from 'effect';

let testCounter = 0;
/** 实验测试功能 */
export const testApi = {
  /** 并发控制测试 — 验证 RPC 系统的并发请求处理能力 */
  concurrencyTest() {
    return Effect.gen(function* () {
      yield* Effect.sleep('1 seconds');
      return { status: 'completed', id: testCounter++, time: new Date().toISOString() };
    });
  },
};
