/** 实验：Effect fiber 上下文能否穿透 tryPromise 内部的深层异步微任务 */
import { Effect, Fiber } from 'effect';

async function deepContinuation() {
  // 模拟 Kysely：异步 hop 之后的同步代码里取 fiber
  await Promise.resolve();
  await Promise.resolve();
  return Fiber.getCurrent();
}

const program = Effect.gen(function* () {
  const f1 = yield* Effect.tryPromise(() => deepContinuation());
  // 对照：Effect 同步栈内直接取
  const f2 = Fiber.getCurrent();
  return { deep: f1 !== undefined, sync: f2 !== undefined };
});

console.log(Effect.runSync(program));
