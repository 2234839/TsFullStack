/**
 * KVStore：跨请求安全状态的统一接口层。
 *
 * 为什么存在：限速计数、封禁标记、一次性票据、OAuth state 等安全状态若直接放
 * 进程内存（new Map / 裸 Cache.make），多实例部署下会被负载均衡稀释/失效
 * （详见 doc/多实例演进分析.md）。所有这类状态必须通过本接口读写——当前是
 * LocalKVStore（单实例内存实现，语义与原来一致），未来切多实例时换
 * RedisKVStore（Redis INCR/PEXPIRE/GETDEL 天然对应）即可，业务代码不动。
 *
 * 判定标准（哪些状态必须走这里）：
 * - 失效/错误会产生安全后果的（限速、封禁、防重放、一次性票据、意图标记）→ 必须走 KVStore
 * - 纯性能缓存（模型列表、鉴权缓存等，允许最终一致）→ 可继续用 Effect Cache
 *
 * key 命名约定：`<域>:<维度>`，如 `login:fail:ip:1.2.3.4`、`oauth:state:<state>`。
 * 值统一 string（复杂结构 JSON 序列化），TTL 显式传入（毫秒）。
 */
import { Context, Effect, Layer } from 'effect';

/** KVStore 的方法集（作为 Service 标签的类型参数） */
export interface KVStoreApi {
  /**
   * 原子自增并返回自增后的值（限速计数核心原语）。
   * TTL 在首次自增时生效（窗口计数语义）；实现需保证原子性。
   */
  incr: (key: string, ttlMs: number) => Effect.Effect<number>;
  /** 读取（不存在返回 null） */
  get: (key: string) => Effect.Effect<string | null>;
  /** 写入带 TTL（已存在的 key 覆盖并重置 TTL） */
  set: (key: string, value: string, ttlMs: number) => Effect.Effect<void>;
  /** 删除（撤销/重置） */
  del: (key: string) => Effect.Effect<void>;
  /**
   * 原子 compare-and-delete：仅当当前值与 expected 相等才删除。
   * 一次性票据防并发重放的核心原语（两个并发请求只有一个成功）。
   */
  takeIfEqual: (key: string, expected: string) => Effect.Effect<boolean>;
  /** 按前缀删除（key 集合失效，如某用户维度的全部缓存 key） */
  delByPrefix: (prefix: string) => Effect.Effect<void>;
}

export class KVStore extends Context.Service<KVStore, KVStoreApi>()('KVStore') {}

/** 单条 KV 记录 */
interface Entry {
  value: string;
  /** 过期时刻（Date.now() 毫秒），惰性过期：读写时顺手清理 */
  expiresAt: number;
}

/** 内存条目容量上限（防 key 无限累积，超出时全量清理过期项后仍超限则清最早项） */
const MAX_ENTRIES = 100_000;

/**
 * 单实例内存实现（LocalLayer）。
 * 语义与此前散落各处的 Map/Cache 一致，集中收口；并发原子性由 JS 单线程保证。
 * 切多实例时实现 RedisKVStore 并在此处替换导出，接口与业务代码不变。
 */
const store = new Map<string, Entry>();

/** 读写前顺手清理过期条目；超限时先清过期再淘汰最早插入项 */
function evictIfNeeded(): void {
  const now = Date.now();
  if (store.size < MAX_ENTRIES) {
    return;
  }
  for (const [k, e] of store) {
    if (e.expiresAt < now) store.delete(k);
  }
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/** 读取有效条目（过期返回 undefined 并顺手删除） */
function getValid(key: string): Entry | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry;
}

export const LocalKVStoreLive = Layer.succeed(
  KVStore,
  KVStore.of({
    incr: (key, ttlMs) =>
      Effect.sync(() => {
        evictIfNeeded();
        const existing = getValid(key);
        const next = (existing ? Number(existing.value) : 0) + 1;
        store.set(key, { value: String(next), expiresAt: Date.now() + ttlMs });
        return next;
      }),
    get: (key) => Effect.sync(() => getValid(key)?.value ?? null),
    set: (key, value, ttlMs) =>
      Effect.sync(() => {
        evictIfNeeded();
        store.set(key, { value, expiresAt: Date.now() + ttlMs });
      }),
    del: (key) =>
      Effect.sync(() => {
        store.delete(key);
      }),
    takeIfEqual: (key, expected) =>
      Effect.sync(() => {
        const entry = getValid(key);
        if (!entry || entry.value !== expected) return false;
        store.delete(key);
        return true;
      }),
    delByPrefix: (prefix) =>
      Effect.sync(() => {
        for (const k of store.keys()) {
          if (k.startsWith(prefix)) store.delete(k);
        }
      }),
  }),
);
