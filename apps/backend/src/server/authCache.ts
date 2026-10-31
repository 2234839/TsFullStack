import { Cache, Effect } from 'effect';
import { getDbAuthEffect, createAuthDbClient } from '../Context/DbService';
import type { Database } from '../Context/Auth';
import { ReqCtxService } from '../Context/ReqCtx';
import { AppConfigService } from '../Context/AppConfig';
import type { MsgError, LogoutError, ToLoginError } from '../util/error';
import type { User, Role, UserSession } from '../../.zenstack/models';

/** 缓存的用户数据类型 */
type AuthUser = Omit<User, 'password'> & { role: Role[]; userSession: UserSession[] };

/** getDbAuthEffect 的入参类型 */
type AuthOpt = { userId?: string; email?: string; sessionToken?: string; sessionID?: number };

/** 用户缓存配置 */
const CACHE_MAX_SIZE = 500; // 最多缓存 500 个用户
const CACHE_TTL = '10 minutes'; // 10分钟过期

/**
 * 用户鉴权缓存：Effect Cache 承担容量淘汰 + TTL 过期 + 并发单飞（并发同 key 只查一次库）
 *
 * 为什么只缓存用户数据，不缓存整个 Database 对象：
 * Database.db 对象包含 onQuery 钩子，该钩子闭包捕获了创建时的 ReqCtxService。
 * 如果缓存整个 Database 对象，后续请求会使用第一次请求的 ReqCtxService，
 * 导致日志中的 reqId 始终是第一次请求的 ID，无法正确追踪请求链路。
 *
 * 解决方案：
 * - 只缓存纯数据，每次请求重新创建 db 客户端，确保有正确的 ReqCtxService
 * - requireServicesAt: "lookup" 让 lookup 的依赖（ReqCtxService/AppConfigService）
 *   延迟到 Cache.get 调用时从当前上下文解析，缓存创建本身无 R 要求
 */
const userCache = Effect.runSync(
  Cache.make<string, AuthUser, MsgError | LogoutError | ToLoginError, ReqCtxService | AppConfigService, 'lookup'>({
    capacity: CACHE_MAX_SIZE,
    timeToLive: CACHE_TTL,
    requireServicesAt: 'lookup',
    /** key 为 getAuthFromCache 序列化的认证入参数组，仅由本模块写入，parse 还原安全 */
    lookup: (key) => {
      /** cacheKey 是按固定顺序序列化的字段数组，这里按同序还原为对象 */
      const [userId, email, sessionToken, sessionID] = JSON.parse(key) as [
        AuthOpt['userId'],
        AuthOpt['email'],
        AuthOpt['sessionToken'],
        AuthOpt['sessionID'],
      ];
      return Effect.map(
        getDbAuthEffect({ userId, email, sessionToken, sessionID }),
        (prismaResult) => prismaResult.user,
      );
    },
  }),
);

/**
 * 基于内存的用户鉴权缓存，避免每次请求都查询数据库中的用户信息
 */
export function getAuthFromCache(opt: AuthOpt) {
  return Effect.gen(function* () {
    const cacheKey = JSON.stringify([opt.userId, opt.email, opt.sessionToken, opt.sessionID]);

    const user = yield* Cache.get(userCache, cacheKey);

    /** 反向登记 userId → cacheKey，供会话撤销时精确失效（索引容量上限保护内存） */
    indexUserKey(user.id, cacheKey);

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

/** userId → 缓存 key 集合的反向索引；超限整体重建（退化为 TTL 失效，安全兜底） */
const userKeysIndex = new Map<string, Set<string>>();
const USER_KEYS_INDEX_MAX = 2000;

function indexUserKey(userId: string, cacheKey: string) {
  if (userKeysIndex.size > USER_KEYS_INDEX_MAX) userKeysIndex.clear();
  let keys = userKeysIndex.get(userId);
  if (!keys) {
    keys = new Set();
    userKeysIndex.set(userId, keys);
  }
  keys.add(cacheKey);
}

/**
 * 会话撤销/用户状态变更后立即失效该用户的全部鉴权缓存条目
 * （登出、账号合并等删除会话后调用，消除最长 10 分钟的凭据残留窗口）
 */
export function invalidateAuthUserCache(userId: string) {
  const keys = userKeysIndex.get(userId);
  if (!keys) return;
  for (const key of keys) Effect.runSync(Cache.invalidate(userCache, key));
  userKeysIndex.delete(userId);
}
