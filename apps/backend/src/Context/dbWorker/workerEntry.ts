/**
 * dbWorker 入口：真实持有 better-sqlite3 + ZenStack 客户端，跑在 worker_threads 里。
 *
 * 装配与观测原语来自共有层 dbCore（直连模式 localDb.ts 引用同一层），
 * 本文件只做 worker 特有的部分：
 * - 客户端注册表（base / auth 派生客户端，auth 按 user 缓存）
 * - 交互式事务：txBegin 挂起事务连接，主线程回调里的每个操作凭 txId 路由到同一事务客户端
 * - 观测事件缓冲：cost-logger 采集的记录随 call 响应回传主线程（时间窗认领）
 *
 * 注意：本文件禁止 import Effect / fastify 等主线程模块（worker bundle 独立打包）。
 */
import { parentPort } from 'node:worker_threads';
import Database from 'better-sqlite3';
import type { WorkerDbClient as DbClient } from './clientType';
import type { DbWorkerRequest, DbWorkerResponse, WorkerDriverTiming, WorkerSqlEvent } from './protocol';
import { serializeError } from './protocol';
import {
  createBaseClient,
  createDriverTimingEngine,
  deriveAuthClient,
  makeCostLoggerPlugin,
  shareInputValidator,
  type CostLogEvent,
} from './dbCore';

// ---------------------------------------------------------------------------
// 驱动计时引擎与观测事件缓冲（共有层引擎 + worker 侧事件收集）
// ---------------------------------------------------------------------------

const engine = createDriverTimingEngine();

/** 单条模型操作观测记录（claimed 机制与驱动计时相同：先结束先认领，嵌套查询内层先认领） */
interface SqlEventEntry extends WorkerSqlEvent {
  claimed: boolean;
}

const _sqlEvents: SqlEventEntry[] = [];
const SQL_EVENTS_CAP = 2000;

/** cost-logger 事件去向：缓冲待主线程按调用窗口认领回传 */
function bufferEvent(ev: CostLogEvent): void {
  if (_sqlEvents.length >= SQL_EVENTS_CAP) _sqlEvents.splice(0, 500);
  _sqlEvents.push({
    model: ev.model,
    operation: ev.operation,
    ms: ev.ms,
    execMs: ev.execMs,
    atMs: ev.atMs,
    claimed: false,
  });
}

const costLoggerPlugin = makeCostLoggerPlugin(engine, { onResult: bufferEvent });

/**
 * 认领 [t0, t1]（本线程 performance.now 时基 ms）窗口内的未认领模型操作记录，随 call 响应回传主线程。
 *
 * 事件按 atMs 单调递增入队：找到首个 ≥ t0 的位置后向后扫，越过 t1 即终止，
 * 避免每次调用全量扫描缓冲（高频调用下热路径）；已认领条目会随容量淘汰自然清除。
 */
function claimSqlEvents(t0: number, t1: number): WorkerSqlEvent[] {
  const hits: WorkerSqlEvent[] = [];
  const n = _sqlEvents.length;
  /** 二分找首个 atMs >= t0 的候选（claimed 条目跳过即可，不影响窗口正确性） */
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (_sqlEvents[mid]!.atMs < t0) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < n; i++) {
    const e = _sqlEvents[i]!;
    if (e.atMs > t1) break;
    if (e.claimed) continue;
    e.claimed = true;
    hits.push({ model: e.model, operation: e.operation, ms: e.ms, execMs: e.execMs, atMs: e.atMs });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// 客户端注册表与事务
// ---------------------------------------------------------------------------

/** 库连接与 base 客户端（无 PolicyPlugin，与原 DbClientEffect 语义一致） */
let _database: Database.Database | null = null;
let _baseClient: DbClient | null = null;
let _dbPath: string | null = null;

/** clientId → 客户端（base + auth 派生） */
const _clients = new Map<string, DbClient>();

/**
 * auth 客户端缓存条目（LRU + TTL，语义对齐主线程 authCache.ts 的 Effect Cache 配置）。
 *
 * 注意：worker 线程禁止依赖 Effect（dbCore 共有层约束），Effect Cache.make 不可用，
 * 故在此手写等价的容量淘汰 + TTL 过期；Map 自带插入序，get 时重插即实现 LRU 触碰。
 */
const AUTH_CACHE_MAX_SIZE = 500;
const AUTH_CACHE_TTL_MS = 10 * 60 * 1000;
interface AuthCacheEntry {
  clientId: string;
  /** 条目写入时刻（performance.now，worker 时基；惰性过期，读取时判定） */
  atMs: number;
}
const _authClientCache = new Map<string, AuthCacheEntry>();
let _authClientSeq = 0;

/** 淘汰策略：先清过期条目，仍超容量则逐出最旧（Map 插入序首位） */
function evictAuthCacheIfNeeded(): void {
  if (_authClientCache.size <= AUTH_CACHE_MAX_SIZE) return;
  const now = performance.now();
  for (const [k, v] of _authClientCache) {
    if (now - v.atMs > AUTH_CACHE_TTL_MS) _authClientCache.delete(k);
  }
  while (_authClientCache.size > AUTH_CACHE_MAX_SIZE) {
    const oldest = _authClientCache.keys().next();
    if (oldest.done) break;
    _authClientCache.delete(oldest.value);
  }
}

/** 建库与 base 客户端（惰性，路径变化时重建） */
function ensureBase(databasePath: string): DbClient {
  if (_baseClient && _dbPath === databasePath) return _baseClient;
  if (_database) _database.close();
  const { client, database } = createBaseClient(engine, databasePath);
  /** cost-logger 挂在 base 上：auth/事务派生客户端继承整条插件链 */
  const withLog = client.$use(costLoggerPlugin);
  shareInputValidator(client, withLog);
  _database = database;
  _baseClient = withLog;
  _dbPath = databasePath;
  _clients.clear();
  _clients.set('base', withLog);
  _authClientCache.clear();
  return withLog;
}

/** 派生带权限的客户端（PolicyPlugin + $setAuth），按 user LRU+TTL 缓存复用（validator 已共享，复用安全） */
function createAuthClient(user: unknown): string {
  const userKey = JSON.stringify(user);
  const cached = _authClientCache.get(userKey);
  if (cached) {
    if (performance.now() - cached.atMs <= AUTH_CACHE_TTL_MS && _clients.has(cached.clientId)) {
      /** LRU 触碰：删除重插，移到插入序末尾 */
      _authClientCache.delete(userKey);
      _authClientCache.set(userKey, cached);
      return cached.clientId;
    }
    _authClientCache.delete(userKey);
  }
  if (!_baseClient) throw new Error('dbWorker 尚未 init（未收到 init 消息）');
  const authed = deriveAuthClient(_baseClient, user);
  const clientId = `auth:${++_authClientSeq}`;
  _clients.set(clientId, authed);
  _authClientCache.set(userKey, { clientId, atMs: performance.now() });
  evictAuthCacheIfNeeded();
  return clientId;
}

/** 挂起中的交互式事务 */
interface PendingTx {
  client: DbClient;
  /** 提交（resolve 外层回调 Promise，事务 commit） */
  resolve: () => void;
  /** 回滚（reject 外层回调 Promise，事务 rollback） */
  reject: () => void;
  /** $transaction 整体 Promise：commit/rollback 后 settle，用于感知事务真实结束 */
  outer: Promise<unknown>;
  watchdog: ReturnType<typeof setTimeout>;
}
const _transactions = new Map<string, PendingTx>();
let _txSeq = 0;

/** 事务看门狗超时：与 Prisma 交互式事务默认值一致 */
const TX_TIMEOUT_MS = 5000;

/**
 * 开启交互式事务：$transaction 回调内挂起（返回不 settle 的 Promise），
 * 事务客户端登记进注册表，主线程凭 txId 继续操作，txEnd 时 settle 触发 commit/rollback。
 */
async function txBegin(clientId: string, timeoutMs: number): Promise<string> {
  const client = _clients.get(clientId);
  if (!client) throw new Error(`dbWorker 客户端不存在: ${clientId}`);
  let txClient: DbClient | undefined;
  let resolveFn: (() => void) | undefined;
  let rejectFn: (() => void) | undefined;
  /** 回调 Promise 被 settle 前 $transaction 不返回 —— 事务保持打开 */
  const outer = client
    .$transaction(async (tx) => {
      txClient = tx as DbClient;
      await new Promise<void>((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
      });
    })
    .catch(() => {
      /** rollback 路径：外层以拒绝收场是预期行为，吞掉避免 unhandledRejection */
    });
  /** 等回调进入挂起态（txClient 已注入） */
  await new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      if (txClient !== undefined) {
        clearInterval(timer);
        resolve();
      }
    }, 1);
  });
  const txId = `tx:${++_txSeq}`;
  const pending: PendingTx = {
    client: txClient!,
    resolve: () => resolveFn?.(),
    reject: () => rejectFn?.(),
    outer,
    /** 看门狗：主线程崩溃/遗漏 txEnd 时自动回滚，防止悬挂事务锁死单连接 */
    watchdog: setTimeout(() => {
      if (_transactions.has(txId)) {
        _transactions.delete(txId);
        pending.reject();
      }
    }, timeoutMs),
  };
  _transactions.set(txId, pending);
  return txId;
}

/** 结束事务：commit=true 走 resolve（提交），否则 reject（回滚） */
async function txEnd(txId: string, commit: boolean): Promise<void> {
  const pending = _transactions.get(txId);
  if (!pending) throw new Error(`dbWorker 事务不存在或已超时: ${txId}`);
  _transactions.delete(txId);
  clearTimeout(pending.watchdog);
  if (commit) pending.resolve();
  else pending.reject();
  await pending.outer;
}

// ---------------------------------------------------------------------------
// 消息处理
// ---------------------------------------------------------------------------

/** RPC 方法路径里的禁用属性段（与主线程 createRPC 的黑名单语义对齐） */
const FORBIDDEN_PROPS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

/** 按点分路径在客户端对象上解析方法并调用（必须带接收者调用，ZenStack 方法依赖 this） */
async function resolveAndCall(client: DbClient, method: string, args: unknown[]): Promise<unknown> {
  const parts = method.split('.');
  for (const part of parts) {
    if (FORBIDDEN_PROPS.has(part)) throw new Error(`禁止访问敏感属性: ${part}`);
  }
  let current: unknown = client;
  /** 接收者随访问链推进，调用时必须带接收者（摘成变量裸调会丢 this 崩溃） */
  let receiver: Record<string, unknown> = client as unknown as Record<string, unknown>;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') throw new Error(`方法 ${method} 未找到`);
    receiver = current as Record<string, unknown>;
    current = receiver[part];
    if (current == null) throw new Error(`方法 ${method} 未找到`);
  }
  if (typeof current !== 'function') throw new Error(`${method} 不是一个函数`);
  return await (current as (...a: unknown[]) => unknown).apply(receiver, args);
}

/** 统一响应封装：错误压平为可克隆数据，call 附带窗口内观测记录 */
function send(
  port: NonNullable<typeof parentPort>,
  id: number,
  fn: () => Promise<unknown> | unknown,
  withEvents?: boolean,
): void {
  void (async () => {
    const t0 = performance.now();
    try {
      const result = await fn();
      const events = withEvents ? claimSqlEvents(t0, performance.now()) : undefined;
      port.postMessage({ id, ok: true, result, events } satisfies DbWorkerResponse);
    } catch (error) {
      port.postMessage({ id, ok: false, error: serializeError(error) } satisfies DbWorkerResponse);
    }
  })();
}

const port = parentPort;
if (!port) throw new Error('dbWorker 必须以 worker_threads 方式启动');

port.on('message', (msg: DbWorkerRequest) => {
  switch (msg.type) {
    case 'init':
      /** 只建库不回传客户端实例（不可结构化克隆），回传 ready 标记 */
      send(port, msg.id, () => {
        ensureBase(msg.databasePath);
        return { ready: true };
      });
      break;
    case 'clockSync':
      send(port, msg.id, () => performance.now());
      break;
    case 'createAuthClient':
      send(port, msg.id, () => ({ __clientId: createAuthClient(msg.user) }));
      break;
    case 'call': {
      send(
        port,
        msg.id,
        () => {
          const client = msg.txId ? _transactions.get(msg.txId)?.client : _clients.get(msg.clientId);
          if (!client) {
            throw new Error(msg.txId ? `dbWorker 事务不存在: ${msg.txId}` : `dbWorker 客户端不存在: ${msg.clientId}`);
          }
          return resolveAndCall(client, msg.method, msg.args);
        },
        true,
      );
      break;
    }
    case 'txBegin':
      send(port, msg.id, () => txBegin(msg.clientId, msg.timeoutMs));
      break;
    case 'txEnd':
      send(port, msg.id, () => txEnd(msg.txId, msg.commit));
      break;
    case 'snapshot':
      send(port, msg.id, () => engine.snapshot(msg.fromMs, msg.toMs) as WorkerDriverTiming[]);
      break;
  }
});
