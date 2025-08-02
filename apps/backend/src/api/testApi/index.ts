import { Effect } from 'effect';
import { ReqCtxService } from '../../Context/ReqCtx';

let id = 0;
/** 实验测试功能 */
export const testApi = {
  并发控制() {
    return Effect.gen(function* () {
      yield* Effect.sleep('1 seconds');
      return { status: 'completed', id: id++, time: new Date().toISOString() };

      const mutex = yield* Effect.makeSemaphore(3);
      const ctx = yield* ReqCtxService;
      const task = Effect.gen(function* () {
        yield* Effect.log('start');
        yield* Effect.sleep('1 seconds');
        yield* Effect.log('end');
        return { status: 'completed', id: id++, time: new Date().toISOString() };
      });

      const semTask = mutex.withPermits(1)(task);

      return yield* semTask;
    });
  },
};
