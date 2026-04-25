import { Effect } from 'effect';

let testCounter = 0;
/** 实验测试功能 */
export const testApi = {
  /** 并发控制测试 — 验证 RPC 系统的并发请求处理能力 */
  concurrencyTest() {
    return Effect.sleep('1 seconds').pipe(
      Effect.map(() => ({ status: 'completed' as const, id: testCounter++, time: new Date().toISOString() })),
    );
  },
};
