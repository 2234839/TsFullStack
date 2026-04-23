import { Effect } from 'effect';
import { getDbAuthEffect, createAuthDbClient } from '../Context/DbService';
import type { Database } from '../Context/Auth';
import type { User, Role, UserSession } from '../../.zenstack/models';
import { MS_PER_MINUTE } from '../util/constants';
import { LRUCache } from '../util/lruCache';

/**
 * 缓存条目类型
 */
type CacheEntry = {
  user: Omit<User, 'password'> & { role: Role[]; userSession: UserSession[] };
  expiresAt: number;
};

/**
 * 用户缓存配置
 */
const CACHE_MAX_SIZE = 500; // 最多缓存 500 个用户
const CACHE_TTL = 10 * MS_PER_MINUTE; // 10分钟过期时间
const CACHE_CLEANUP_INTERVAL_MS = 30_000; // 清理间隔 30 秒

/** 用户 LRU 缓存 */
const userCache = new LRUCache<string, CacheEntry>(CACHE_MAX_SIZE);

/** 定时清理过期缓存 — 存储句柄以便 shutdown 时清理 */
let cleanupTimer: NodeJS.Timeout | null = setInterval(() => {
  const now = Date.now();
  userCache.cleanUp((entry) => entry.expiresAt < now);
}, CACHE_CLEANUP_INTERVAL_MS);

/** 停止缓存定时器（graceful shutdown 时调用） */
export function destroyAuthCache(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * 基于内存的用户鉴权缓存，避免每次请求都查询数据库中的用户信息
 *
 * 为什么只缓存用户数据，不缓存整个 Database 对象：
 * Database.db 对象包含 onQuery 钩子，该钩子闭包捕获了创建时的 ReqCtxService。
 * 如果缓存整个 Database 对象，后续请求会使用第一次请求的 ReqCtxService，
 * 导致日志中的 reqId 始终是第一次请求的 ID，无法正确追踪请求链路。
 *
 * 解决方案：
 * - 只缓存纯数据
 * - 每次请求重新创建 db 客户端，确保有正确的 ReqCtxService
 * - 使用 LRU 缓存，自动淘汰不活跃用户，控制内存使用
 * - 这样既获得了缓存带来的性能提升，又保证了上下文的正确性
 *
 * 为什么不使用 WeakMap：
 * - WeakMap 的键必须是对象，而我们的缓存键是字符串（userId + email + sessionToken + sessionID）
 * - 如果创建对象包装键，这个对象本身需要被强引用（否则立即被 GC 回收）
 * - 既然需要强引用键对象，WeakMap 的自动垃圾回收优势就无法发挥
 * - 对于字符串键的缓存场景，纯 Map + LRU 是最优解
 */
export function getAuthFromCache(opt: {
  userId?: string;
  email?: string;
  sessionToken?: string;
  sessionID?: number;
}) {
  return Effect.gen(function* () {
    const cacheKey = `${opt.userId}-${opt.email}-${opt.sessionToken}-${opt.sessionID}`;
    const now = Date.now();
    const cached = userCache.get(cacheKey);

    let user: Omit<User, 'password'> & { role: Role[]; userSession: UserSession[] };

    if (cached && cached.expiresAt > now) {
      // 缓存命中，直接使用缓存的用户数据
      user = cached.user;
    } else {
      // 缓存未命中，查询数据库
      const prismaResult = yield* getDbAuthEffect(opt);
      user = prismaResult.user;

      // 更新缓存（只缓存用户数据，不缓存 db 对象）
      userCache.set(cacheKey, {
        user,
        expiresAt: now + CACHE_TTL,
      });
    }

    // 每次请求都重新创建 db 客户端，确保有正确的 ReqCtxService
    // 这是关键：db 对象的 onQuery 钩子会捕获当前请求的 ReqCtxService
    const db = yield* createAuthDbClient(user);

    const res: Database = {
      db,
      user,
    };
    return res;
  });
}
