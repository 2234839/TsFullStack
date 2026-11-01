/**
 * 进程内直连的 DbClient 实现（config.dbWorker=false 的回退路径，等价于 worker 化之前的原行为）。
 *
 * 装配与观测原语全部来自共有层 dbCore（worker 模式 workerEntry.ts 引用同一层），
 * 本文件只做直连特有的部分：
 * - 模块级客户端缓存（路径变化时重建，语义与原 DbService 一致）
 * - cost-logger 事件直接写 ReqCtx（无需跨线程回传），span 在本地 Effect Tracer 上创建
 * - 事务为 ZenStack 原生交互式事务（同进程回调直调，无挂起协议）
 */
import { Context, Exit, Option } from 'effect';
import type { WorkerDbClient as DbClient } from './clientType';
import type { ReqCtx } from '../ReqCtx';
import {
  createBaseClient,
  createDriverTimingEngine,
  deriveAuthClient,
  makeCostLoggerPlugin,
  sanitizeArgsForLog,
  shareInputValidator,
  type CoreDriverTiming,
} from './dbCore';

/** 直连模式的驱动计时引擎（与 worker 各自独立实例，时基即本进程 performance.now） */
const engine = createDriverTimingEngine();

/** 快照驱动层语句记录（同步版本，直连模式下诊断直接可用；atMs 为本进程时基） */
export function snapshotLocalDriverTimings(fromMs: number, toMs: number): CoreDriverTiming[] {
  return engine.snapshot(fromMs, toMs);
}

/** 模块级缓存（整个应用生命周期，路径变化时重建） */
let _cachedDatabase: ReturnType<typeof createBaseClient>['database'] | null = null;
let _cachedBase: DbClient | null = null;
let _cachedDbPath: string | null = null;
/** 无日志插件包装的客户端缓存（无 ReqCtx 场景复用） */
let _cachedNoLog: DbClient | null = null;
/** cost-logger 事件去向：直接写 ReqCtx（log + sqlEvents），span 由 wrapProceed 在本地创建 */
function withCostLogger(base: DbClient, reqCtx: ReqCtx): DbClient {
  const client = base.$use(
    makeCostLoggerPlugin(engine, {
      onResult: (ev) => {
        reqCtx.log(
          `sql ${Math.round(ev.ms)}ms (exec ${Math.round(ev.execMs * 100) / 100}ms) > ${ev.model}.${ev.operation} ${sanitizeArgsForLog(ev.args)}`,
        );
        reqCtx.sqlEvents.push({
          model: ev.model,
          operation: ev.operation,
          ms: Math.round(ev.ms),
          execMs: Math.round(ev.execMs * 100) / 100,
          at: Math.round(ev.atMs - reqCtx.t0),
        });
      },
      /** span 挂根 span，组树阶段按时间区间重定到真正包裹它的业务 span（与原实现一致） */
      wrapProceed: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
        const collector = reqCtx.spanCollector;
        if (!collector) return fn();
        const parent = collector.rootSpan;
        const span = collector.tracer.span({
          name,
          startTime: collector.nowNanos(),
          parent: parent ? Option.some(parent) : Option.none(),
          annotations: Context.empty(),
          links: [],
          kind: 'internal',
          root: !parent,
          sampled: true,
        });
        try {
          const result = await fn();
          span.end(collector.nowNanos(), Exit.succeed(undefined));
          return result;
        } catch (error) {
          span.end(collector.nowNanos(), Exit.fail(error));
          throw error;
        }
      },
    }),
  );
  shareInputValidator(base, client);
  return client;
}

/**
 * 获取直连 DbClient（回退模式入口）。
 *
 * @param databasePath 数据库路径
 * @param reqCtx 请求上下文（无则复用 noLog 缓存客户端，如后台任务/seed 场景）
 */
export function getLocalDbClient(databasePath: string, reqCtx?: ReqCtx): DbClient {
  if (!_cachedBase || _cachedDbPath !== databasePath) {
    if (_cachedDatabase) {
      _cachedDatabase.close();
      _cachedDatabase = null;
    }
    const { client, database } = createBaseClient(engine, databasePath);
    _cachedDatabase = database;
    _cachedBase = client;
    _cachedDbPath = databasePath;
    _cachedNoLog = null;
  }
  if (!reqCtx) {
    /** base 本身未挂观测插件，直接复用（无需空插件包装） */
    if (!_cachedNoLog) _cachedNoLog = _cachedBase;
    return _cachedNoLog;
  }
  return withCostLogger(_cachedBase, reqCtx);
}

/** 直连模式派生带权限客户端（PolicyPlugin + $setAuth，validator 共享） */
export function deriveLocalAuthClient(databasePath: string, user: unknown, reqCtx?: ReqCtx): DbClient {
  return deriveAuthClient(getLocalDbClient(databasePath, reqCtx), user);
}
