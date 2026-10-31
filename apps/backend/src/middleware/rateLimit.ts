/**
 * 代币消耗限速：每用户每分钟最多 10 次（固定窗口）。
 * 走 KVStore 接口层——当前 LocalKVStore 单实例内存实现，切多实例时换 Redis 实现即可，
 * 限速自动跨实例生效（见 src/Context/KVStore.ts）。
 */
import { Effect } from 'effect';
import { KVStore } from '../Context/KVStore';

/** 窗口内最大请求数 */
const TOKEN_CONSUME_MAX_REQUESTS = 10;
/** 窗口长度（毫秒） */
const TOKEN_CONSUME_WINDOW_MS = 60_000;

/** 检查代币消耗限速：incr 固定窗口计数，超限即拒绝 */
export function checkTokenConsumeRate(
  userId: string,
): Effect.Effect<{ allowed: boolean; remaining: number }, never, KVStore> {
  return Effect.gen(function* () {
    const kv = yield* KVStore;
    const count = yield* kv.incr(`ratelimit:token:${userId}`, TOKEN_CONSUME_WINDOW_MS);
    return {
      allowed: count <= TOKEN_CONSUME_MAX_REQUESTS,
      remaining: Math.max(0, TOKEN_CONSUME_MAX_REQUESTS - count),
    };
  });
}
