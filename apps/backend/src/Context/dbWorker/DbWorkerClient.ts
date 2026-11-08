/**
 * 主线程侧 dbWorker 通道与 DbClient 透明代理。
 *
 * - getDbWorker(path)：进程级单例 Worker（惰性启动，databasePath 变化时重建），含时钟握手标定
 * - proxyFor()：返回与 ZenStack DbClient 同类型的深度 Proxy，业务调用（db.user.findFirst(...)）零改动
 *   - '$setAuth' → 请求 worker 派生 auth 客户端（惰性 Promise，调用前自动 await）
 *   - '$transaction(fn)' → 交互式事务：begin 拿 txId，回调留在主线程执行，tx 的每个操作带 txId 转发
 *   - 其余全部按点分路径 RPC 转发到 worker
 * - worker 侧 cost-logger 观测记录随响应回传，这里回灌 ReqCtx（log / sqlEvents / span）
 */
import { Worker } from 'node:worker_threads';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { Context, Exit, Option } from 'effect';
import type { WorkerDbClient as DbClient } from './clientType';
import type { ReqCtx } from '../ReqCtx';
import type { DbWorkerRequestBody, DbWorkerRequest, DbWorkerResponse, WorkerSqlEvent } from './protocol';
import { deserializeError } from './protocol';
import { sanitizeArgsForLog } from './dbCore';

/** 日志前缀 */
const LOG_PREFIX = '[dbWorker]';

/** 交互式事务看门狗超时（与 worker 侧 TX_TIMEOUT_MS 对齐） */
const TX_TIMEOUT_MS = 5000;

/** tsx 加载器入口：pnpm 布局下 worker 内裸名 'tsx' 解析不到，须解析为绝对 file URL */
const TSX_LOADER_URL = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;

/** 解析 worker 入口文件：优先环境变量，其次打包产物同目录，最后回退 tsx 直跑源码（vitest/tsx 场景） */
function resolveWorkerEntry(): { file: string; execArgv: string[] } {
  const env = process.env['TSFS_DB_WORKER_FILE'];
  if (env) return { file: env, execArgv: [] };
  const dir = path.dirname(fileURLToPath(import.meta.url));
  /** 主 bundle（dist/index.mjs）产出的 worker 入口（rolldown 多入口保留相对路径 dist/Context/dbWorker/） */
  for (const rel of ['Context/dbWorker/workerEntry.mjs', 'workerEntry.mjs']) {
    const candidate = path.join(dir, rel);
    if (existsSync(candidate)) return { file: candidate, execArgv: [] };
  }
  /** 开发/测试直跑 TS：用 tsx 加载器拉起 worker 源文件 */
  const srcFile = path.join(dir, 'workerEntry.ts');
  if (existsSync(srcFile)) return { file: srcFile, execArgv: ['--import', TSX_LOADER_URL] };
  throw new Error(`${LOG_PREFIX} 找不到 worker 入口（dist 产物与 ${srcFile} 均不存在），可用 TSFS_DB_WORKER_FILE 指定`);
}

interface Pending {
  resolve: (resp: DbWorkerResponse & { ok: true }) => void;
  reject: (error: Error) => void;
}

/** dbWorker 通道：请求/响应按 id 配对，worker 意外退出时快速失败 */
class DbWorkerChannel {
  private nextId = 1;
  private pending = new Map<number, Pending>();
  /** worker performance.now 与主线程 performance.now 的原点偏移（握手标定；同为单调钟，漂移可忽略） */
  clockOffsetMs = 0;
  readonly worker: Worker;
  private broken: Error | null = null;

  constructor() {
    const entry = resolveWorkerEntry();
    this.worker = new Worker(entry.file, { execArgv: entry.execArgv });
    this.worker.on('message', (resp: DbWorkerResponse) => {
      const p = this.pending.get(resp.id);
      if (!p) return;
      this.pending.delete(resp.id);
      if (resp.ok) p.resolve(resp);
      else p.reject(deserializeError(resp.error));
    });
    /** worker 加载/运行异常：与退出同等处理，挂起请求快速失败 */
    this.worker.on('error', (err: Error) => {
      const error = new Error(`${LOG_PREFIX} worker 异常: ${err.message}`, { cause: err });
      for (const p of this.pending.values()) p.reject(error);
      this.pending.clear();
      this.broken = error;
    });
    /** worker 非正常退出：所有挂起请求快速失败，后续请求直接拒绝 */
    this.worker.on('exit', (code) => {
      const error = new Error(`${LOG_PREFIX} worker 已退出 (code=${code})`);
      for (const p of this.pending.values()) p.reject(error);
      this.pending.clear();
      this.broken = error;
    });
    /** 保持进程存活：DB worker 是核心子系统，有活没活都不该让进程静默退出（脚本/工具场景尤其重要） */
  }

  /** 发请求并等响应 */
  request(req: DbWorkerRequestBody): Promise<DbWorkerResponse & { ok: true }> {
    if (this.broken) return Promise.reject(this.broken);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      /** 展开联合请求体 + id 后，TS 无法证明仍属于 DbWorkerRequest，运行时结构即合法 */
      this.worker.postMessage({ ...req, id } as DbWorkerRequest);
    });
  }
}

/** 代理绑定信息：clientId（可惰性）+ 可选事务路由 + 可选请求上下文 */
interface ProxyBinding {
  clientId: string | Promise<string>;
  txId?: string;
  reqCtx?: ReqCtx;
}

/** 主线程持有的 dbWorker 会话（进程级单例语义由 getDbWorker 保证） */
export class DbWorkerSession {
  private constructor(readonly channel: DbWorkerChannel) {}

  /** 建立会话：init 库连接 + 时钟标定（round-trip 中点对齐两线程 performance.now 原点） */
  static async create(databasePath: string): Promise<DbWorkerSession> {
    const channel = new DbWorkerChannel();
    await channel.request({ type: 'init', databasePath });
    const t0 = performance.now();
    const resp = await channel.request({ type: 'clockSync', tMs: 0 });
    const t1 = performance.now();
    channel.clockOffsetMs = (t0 + t1) / 2 - (resp.result as number);
    return new DbWorkerSession(channel);
  }

  /** 发起一次模型调用，返回结果与 worker 侧观测记录（含处理窗口起止，worker 时基） */
  async call(
    clientId: string,
    txId: string | undefined,
    method: string,
    args: unknown[],
  ): Promise<{ result: unknown; events?: WorkerSqlEvent[]; timing?: { startAtMs: number; endAtMs: number } }> {
    const resp = await this.channel.request({ type: 'call', clientId, txId, method, args });
    return { result: resp.result, events: resp.events, timing: resp.timing };
  }

  /** 数据库初始化（seed）整体在 worker 内执行：一次 RPC，SQL 与 bcrypt 均不占主线程 */
  async seed(admin: { adminEmail: string; adminPassword: string; production: boolean }): Promise<void> {
    await this.channel.request({ type: 'seed', ...admin });
  }

  /** 派生 auth 客户端（PolicyPlugin + $setAuth 在 worker 侧完成），返回 clientId */
  async createAuthClient(user: unknown): Promise<string> {
    const resp = await this.channel.request({ type: 'createAuthClient', user });
    const holder = resp.result as { __clientId: string };
    return holder.__clientId;
  }

  async txBegin(clientId: string): Promise<string> {
    const resp = await this.channel.request({ type: 'txBegin', clientId, timeoutMs: TX_TIMEOUT_MS });
    return resp.result as string;
  }

  async txEnd(txId: string, commit: boolean): Promise<void> {
    await this.channel.request({ type: 'txEnd', txId, commit });
  }

  /** worker 内模型操作时刻（worker 时基）→ 主线程 performance.now 时基 */
  toMainClock(atMs: number): number {
    return atMs + this.channel.clockOffsetMs;
  }

  /** 终止 worker 线程（会话重建/进程收尾用） */
  terminate(): void {
    void this.channel.worker.terminate();
  }

  /**
   * 创建绑定到指定客户端的 DbClient 代理。
   *
   * @param clientId 基础客户端 id（'base'）或派生客户端 id 的惰性 Promise（$setAuth 场景）
   * @param reqCtx 请求上下文（存在时回灌 log/sqlEvents/span；后台任务等无 ctx 场景传 undefined）
   */
  proxyFor(clientId: string | Promise<string>, reqCtx?: ReqCtx): DbClient {
    const session = this;
    const binding: ProxyBinding = { clientId, reqCtx };

    /** 嵌套路径代理：访问链收集为点分路径，调用时 RPC 转发 */
    const makeNested = (currentPath: string[], txId?: string): unknown =>
      new Proxy(function () {} as unknown as object, {
        get(_t, prop) {
          if (prop === 'then') return undefined;
          return makeNested([...currentPath, String(prop)], txId);
        },
        apply(_t, _thisArg, args) {
          return doCall(session, { ...binding, txId }, currentPath.join('.'), args);
        },
      });

    /** 根代理：拦截元方法（$transaction/$setAuth/$use），其余走嵌套路径代理 */
    return new Proxy(function () {} as unknown as object, {
      get(_t, prop) {
        if (prop === 'then') return undefined;
        if (prop === '$transaction') {
          return (fn: (tx: never) => unknown) => runInteractiveTx(session, binding, fn);
        }
        if (prop === '$setAuth') {
          /** 同步返回新代理（与 ZenStack $setAuth 签名一致），clientId 惰性解析 */
          return (user: unknown) => session.proxyFor(session.createAuthClient(user), binding.reqCtx);
        }
        if (prop === '$use') {
          /** 插件（函数+闭包）无法跨线程传递；本项目插件已全部集中在 worker 装配，此处空操作保持链式不炸 */
          console.warn(`${LOG_PREFIX} $use 在 worker 化客户端上为空操作（插件统一在 worker 装配）`);
          return () => session.proxyFor(binding.clientId, binding.reqCtx);
        }
        return makeNested([String(prop)]);
      },
    }) as unknown as DbClient;
  }
}

/** 单次模型调用：RPC 转发 + 观测回灌 ReqCtx（日志 / sqlEvents / span，语义与原 withCostLogger 对齐） */
async function doCall(
  session: DbWorkerSession,
  binding: ProxyBinding,
  method: string,
  args: unknown[],
): Promise<unknown> {
  const clientId = await binding.clientId;
  const reqCtx = binding.reqCtx;
  const collector = reqCtx?.spanCollector;
  /** span 挂根 span，组树阶段按时间区间重定到真正包裹它的业务 span（与原实现一致） */
  const parent = collector?.rootSpan;
  const span =
    collector &&
    collector.tracer.span({
      name: `sql:db·${method}`,
      startTime: collector.nowNanos(),
      parent: parent ? Option.some(parent) : Option.none(),
      annotations: Context.empty(),
      links: [],
      kind: 'internal',
      root: !parent,
      sampled: true,
    });
  try {
    const tSend = performance.now();
    const { result, events, timing } = await session.call(clientId, binding.txId, method, args);
    const tRecv = performance.now();
    if (span) span.end(collector!.nowNanos(), Exit.succeed(undefined));
    /** 线程分解：投递排队（发出→worker开始处理）/ worker 执行 / 回传（worker 完成响应→主线程收到） */
    if (timing && reqCtx) {
      const start = session.toMainClock(timing.startAtMs);
      const end = session.toMainClock(timing.endAtMs);
      reqCtx.dbTimings.push({
        method,
        at: Math.round(tSend - reqCtx.t0),
        queueMs: Math.max(0, Math.round(start - tSend)),
        execMs: Math.max(0, Math.round((end - start) * 100) / 100),
        returnMs: Math.max(0, Math.round(tRecv - end)),
      });
    }
    /** 回灌观测：worker 侧窗口认领的模型操作（含权限检查引发的子查询）逐条还原成 sqlEvents/日志 */
    if (reqCtx) {
      for (const ev of events ?? []) {
        reqCtx.log(
          `sql ${Math.round(ev.ms)}ms (exec ${Math.round(ev.execMs * 100) / 100}ms) > ${ev.model}.${ev.operation} ${sanitizeArgsForLog(args[0] as Record<string, unknown> | undefined)}`,
        );
        reqCtx.sqlEvents.push({
          model: ev.model,
          operation: ev.operation,
          ms: Math.round(ev.ms),
          execMs: Math.round(ev.execMs * 100) / 100,
          /** worker 时基 → 主线程时基 → 请求相对时刻 */
          at: Math.round(session.toMainClock(ev.atMs) - reqCtx.t0),
          driver: ev.driver,
        });
      }
    }
    return result;
  } catch (error) {
    if (span) span.end(collector!.nowNanos(), Exit.fail(error));
    throw error;
  }
}

/** 交互式事务：回调留在主线程执行，tx 的每个操作凭 txId 路由到 worker 侧同一事务客户端 */
async function runInteractiveTx(
  session: DbWorkerSession,
  binding: ProxyBinding,
  fn: (tx: never) => unknown,
): Promise<unknown> {
  const clientId = await binding.clientId;
  const txId = await session.txBegin(clientId);
  const txBinding: ProxyBinding = { clientId, txId, reqCtx: binding.reqCtx };
  try {
    const result = await fn(makeTxProxy(session, txBinding) as never);
    await session.txEnd(txId, true);
    return result;
  } catch (error) {
    /** 回调抛错：rollback 后把原始错误抛回调用方（与 Prisma 语义一致；看门狗超时的 txEnd 会因事务已清理而报错，吞掉） */
    try {
      await session.txEnd(txId, false);
    } catch (rollbackError) {
      console.error(`${LOG_PREFIX} 事务回滚失败 txId=${txId}:`, rollbackError);
    }
    throw error;
  }
}

/** 事务客户端代理：所有模型操作带 txId；事务内不允许再派生/嵌套 */
function makeTxProxy(session: DbWorkerSession, binding: ProxyBinding): DbClient {
  const makeNested = (currentPath: string[]): unknown =>
    new Proxy(function () {} as unknown as object, {
      get(_t, prop) {
        if (prop === 'then') return undefined;
        return makeNested([...currentPath, String(prop)]);
      },
      apply(_t, _thisArg, args) {
        return doCall(session, binding, currentPath.join('.'), args);
      },
    });
  return new Proxy(function () {} as unknown as object, {
    get(_t, prop) {
      if (prop === 'then') return undefined;
      if (prop === '$transaction' || prop === '$setAuth' || prop === '$use') {
        throw new Error(`${LOG_PREFIX} 事务客户端上不支持 ${String(prop)}`);
      }
      return makeNested([String(prop)]);
    },
  }) as unknown as DbClient;
}

/** dbWorker 单例（进程级；databasePath 变化时重建） */
let _sessionPromise: Promise<DbWorkerSession> | null = null;
let _sessionPath: string | null = null;

/** 获取 dbWorker 会话（惰性启动 + init + 时钟标定） */
export function getDbWorker(databasePath: string): Promise<DbWorkerSession> {
  if (_sessionPromise && _sessionPath === databasePath) return _sessionPromise;
  if (_sessionPromise) {
    /** 路径变化：旧 worker 终止重建（正常情况下路径不变，仅配置热切换走到这里） */
    _sessionPromise.then((s) => s.terminate()).catch(() => {});
  }
  _sessionPath = databasePath;
  _sessionPromise = DbWorkerSession.create(databasePath);
  return _sessionPromise;
}
