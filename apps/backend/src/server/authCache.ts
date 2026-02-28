import { Effect } from 'effect';
import { DbService } from '../Context/DbService';
import type { Database } from '../Context/Auth';

const userCache = new Map<string, { res: Database; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1分钟缓存时间
/** 定时清理过期缓存  */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of userCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      userCache.delete(key);
    }
  }
}, 10_000);

/** 基于内存的用户鉴权缓存，避免每次请求都查询数据库中的用户信息  */
export function getAuthFromCache(opt: {
  userId?: string;
  email?: string;
  sessionToken?: string;
  sessionID?: number;
}): Effect.Effect<Database, Error, DbService> {
  return Effect.gen(function* () {
    const cacheKey = `${opt.userId}-${opt.email}-${opt.sessionToken}-${opt.sessionID}`;
    const cached = userCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const { res } = cached;
      return res;
    } else {
      // 缓存未命中或已过期，查询数据库
      const { getPrisma } = yield* DbService;
      const prismaResult = yield* getPrisma(opt);

      const res: Database = {
        db: prismaResult.db,
        user: prismaResult.user,
      };
      // 更新缓存
      userCache.set(cacheKey, { res, timestamp: Date.now() });
      return res;
    }
  });
}
