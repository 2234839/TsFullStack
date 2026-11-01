/**
 * 数据库装配共用核心（共有层）。
 *
 * worker 模式（workerEntry.ts）与直连模式（localDb.ts）共用的装配与观测原语：
 * - 敏感字段脱敏（日志安全）
 * - InputValidator 共享（派生客户端免 zod 冷编译）
 * - 驱动层计时引擎（prepare 注释 id 注入 + 窗口认领 + 快照）
 * - 客户端装配（better-sqlite3 + ZenStackClient + SoftDeletePlugin；PolicyPlugin + $setAuth 派生）
 * - cost-logger 插件工厂（观测事件回调注入，两种模式只差「事件往哪送 + span 谁建」）
 *
 * 约束：本文件会被 worker 加载，禁止依赖 Effect 服务 / fastify（类型引用除外）。
 */
import { definePlugin, InputValidator, ZenStackClient } from '@zenstackhq/orm';
import { SqliteDialect } from '@zenstackhq/orm/dialects/sqlite';
import { PolicyPlugin } from '@zenstackhq/plugin-policy';
import { SoftDeletePlugin } from '@zenstackhq/plugin-soft-delete';
import Database from 'better-sqlite3';
import type { WorkerDbClient as DbClient } from './clientType';
import { schema, type SchemaType } from '../../../.zenstack/schema';

// ---------------------------------------------------------------------------
// 敏感字段脱敏
// ---------------------------------------------------------------------------

/** 需要脱敏的敏感字段名 */
export const SENSITIVE_FIELDS = ['apiKey', 'password', 'token', 'clientSecret', 'sessionToken'] as const;

/** 对数据库操作参数进行脱敏，防止日志泄露 apiKey、password、token 等敏感信息 */
export function sanitizeArgsForLog(args: Record<string, unknown> | undefined): string {
  if (!args) return '{}';
  /** 递归克隆并脱敏敏感字段，一次遍历完成深拷贝+脱敏 */
  const cloneAndRedact = (src: unknown): unknown => {
    if (src == null || typeof src !== 'object') return src;
    if (Array.isArray(src)) return src.map(cloneAndRedact);
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(src)) {
      result[key] = SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f.toLowerCase()))
        ? '[REDACTED]'
        : cloneAndRedact(value);
    }
    return result;
  };
  return JSON.stringify(cloneAndRedact(args));
}

// ---------------------------------------------------------------------------
// InputValidator 共享
// ---------------------------------------------------------------------------

/** ZenStack 客户端实现上持有的输入校验器（公开导出的 InputValidator，但字段不在 ClientContract 类型面上） */
interface ValidatorHolder {
  inputValidator: InputValidator<SchemaType>;
}

/**
 * 共享基座客户端的 InputValidator 到派生客户端。
 *
 * ZenStack 的 ClientImpl 构造函数本来就继承父客户端的 validator，但 $use/$setAuth 路径
 * 会强制 new 一个新的（其 zod schema 缓存是实例字段，新实例首查重编译，实测 20~50ms），
 * 使每条 SQL 都背上这笔固定开销；validator 只依赖 schema 与校验开关、与插件/auth 无关，
 * 共享安全（实测查询从 ~35ms 降到 ~2ms）。
 */
export function shareInputValidator(base: DbClient, derived: DbClient): void {
  (derived as unknown as ValidatorHolder).inputValidator = (base as unknown as ValidatorHolder).inputValidator;
}

// ---------------------------------------------------------------------------
// 驱动层计时引擎
// ---------------------------------------------------------------------------

/** 驱动层真实执行计时记录（better-sqlite3 同步执行，语句之间不会交错） */
export interface CoreDriverTiming {
  /** 语句注释 id（/*sN*\/ 前缀），全局唯一，供 onQuery 认领 */
  id: number;
  /** 语句开始时刻（本引擎的 performance.now 时基毫秒） */
  atMs: number;
  /** 语句耗时 ms */
  ms: number;
  /** 语句 SQL 文本（带注释 id 前缀） */
  sql: string;
}

interface TrackedTiming extends CoreDriverTiming {
  claimed: boolean;
}

/**
 * 驱动层计时引擎：给 better-sqlite3 的 prepare 包计时（SQL 开头注入注释 id），
 * onQuery 按时间窗认领（先结束先认领，嵌套查询内层先认领），请求结束可快照。
 *
 * worker 模式与直连模式各建一个实例（进程/线程隔离，时基独立）。
 */
export function createDriverTimingEngine() {
  const timings: TrackedTiming[] = [];
  const TIMINGS_CAP = 2000;
  let stmtSeq = 0;
  /** hrtime 与 performance.now 的原点差：两个单调钟原点不同，需换算后才能跨模块比较 */
  const hrtimeOrigin = process.hrtime.bigint();
  const perfOrigin = performance.now();

  const hrtimeToPerfMs = (t: bigint): number => Number(t - hrtimeOrigin) / 1e6 + perfOrigin;

  /** 统计一条语句执行，写入缓冲 */
  function record(id: number, sql: string, fn: () => unknown): unknown {
    const start = process.hrtime.bigint();
    try {
      return fn();
    } finally {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      if (timings.length >= TIMINGS_CAP) timings.splice(0, 500);
      timings.push({ id, atMs: hrtimeToPerfMs(start), ms, sql, claimed: false });
    }
  }

  return {
    /** 给 Database 实例包计时（改写 prepare：注释 id 注入 + 语句方法计时） */
    withDriverTiming(db: InstanceType<typeof Database>): InstanceType<typeof Database> {
      const rawPrepare = db.prepare.bind(db) as unknown as (
        sql: string,
      ) => { source?: string } & Record<string, unknown>;
      (db as unknown as Record<string, unknown>).prepare = (sqlArg: unknown) => {
        const id = ++stmtSeq;
        const stmt = rawPrepare(`/*s${id}*/ ${String(sqlArg)}`);
        const sql: string = stmt.source ?? '';
        for (const m of ['get', 'all', 'run', 'iterate'] as const) {
          const raw = (stmt as Record<string, ((...a: unknown[]) => unknown) | undefined>)[m]?.bind(stmt);
          if (!raw) continue;
          stmt[m] = (...args: unknown[]) => record(id, sql, () => raw(...args));
        }
        return stmt;
      };
      return db;
    },

    /** 认领 [t0, t1]（hrtime 纳秒）窗口内的未认领驱动语句，返回真实执行总耗时 ms；认领后不再计入其他查询 */
    claimExecMs(t0: bigint, t1: bigint): number {
      const w0 = hrtimeToPerfMs(t0);
      const w1 = hrtimeToPerfMs(t1);
      let total = 0;
      for (const t of timings) {
        if (t.claimed) continue;
        /** 语句开始落在窗口内即认领（better-sqlite3 同步执行，语句不会跨查询边界） */
        if (t.atMs >= w0 && t.atMs <= w1) {
          t.claimed = true;
          total += t.ms;
        }
      }
      return total;
    },

    /** 快照 [fromMs, toMs]（本引擎时基）窗口内的驱动层语句执行记录，供诊断时间线展示真实执行耗时 */
    snapshot(fromMs: number, toMs: number): CoreDriverTiming[] {
      const rest: TrackedTiming[] = [];
      const hits: CoreDriverTiming[] = [];
      for (const t of timings) {
        if (t.atMs < fromMs) continue;
        if (t.atMs > toMs + 1000) rest.push(t);
        else hits.push({ id: t.id, atMs: t.atMs, ms: t.ms, sql: t.sql });
      }
      timings.length = 0;
      timings.push(...rest);
      return hits;
    },
  };
}

// ---------------------------------------------------------------------------
// 客户端装配
// ---------------------------------------------------------------------------

/** 建基座客户端：better-sqlite3 + ZenStackClient + SoftDeletePlugin（不带 PolicyPlugin，与原 DbClientEffect 语义一致） */
export function createBaseClient(
  engine: ReturnType<typeof createDriverTimingEngine>,
  databasePath: string,
): { client: DbClient; database: InstanceType<typeof Database> } {
  const database = engine.withDriverTiming(new Database(databasePath));
  const client = new ZenStackClient(schema, {
    dialect: new SqliteDialect({ database }),
  })
    /** 软删除：拦截 Kysely 查询，delete→墓碑时间戳，读取自动过滤，只对 @deletedAt 模型生效 */
    .$use(new SoftDeletePlugin()) as unknown as DbClient;
  return { client, database };
}

/** 派生带权限的客户端（PolicyPlugin + $setAuth），两次派生都共享 validator（免每条 SQL 背冷编译税） */
export function deriveAuthClient(base: DbClient, user: unknown): DbClient {
  const withPolicy = base.$use(new PolicyPlugin());
  shareInputValidator(base, withPolicy);
  /** 主线程传来的 user 已是序列化克隆的纯数据（worker 场景），类型面由调用侧保证 */
  const authed = withPolicy.$setAuth(user as Parameters<typeof withPolicy.$setAuth>[0]);
  shareInputValidator(withPolicy, authed);
  return authed;
}

// ---------------------------------------------------------------------------
// cost-logger 插件工厂
// ---------------------------------------------------------------------------

/** 单条模型操作的观测事件（atMs 为本引擎/进程的 performance.now 时基毫秒） */
export interface CostLogEvent {
  model: string;
  operation: string;
  /** 总耗时 ms（含 ORM 校验/建查询包装开销） */
  ms: number;
  /** 驱动层真实执行耗时 ms（语句注释 id 认领），ms - execMs 即 ORM 包装开销 */
  execMs: number;
  /** 操作开始时刻（performance.now 毫秒，本进程时基） */
  atMs: number;
  /** 原始查询参数（脱敏由消费方按需处理） */
  args: Record<string, unknown> | undefined;
}

/** 诊断自身模型不进统计（避免诊断污染诊断） */
export function isDiagModel(model: string): boolean {
  return model === 'SystemLog' || model === 'DiagTrace';
}

/**
 * cost-logger 插件工厂：两种模式共用同一计时骨架，差异全部注入：
 * - onResult：观测事件去向（worker=缓冲随响应回传；直连=直接写 ReqCtx）
 * - wrapProceed：proceed 的包裹层（直连=建 Tracer span；worker=不传，span 在主线程建）
 */
export function makeCostLoggerPlugin(
  engine: ReturnType<typeof createDriverTimingEngine>,
  opts: {
    onResult: (ev: CostLogEvent) => void;
    wrapProceed?: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  },
) {
  return definePlugin({
    id: 'cost-logger',
    onQuery: async ({ model, operation, args, proceed }) => {
      if (isDiagModel(model)) {
        return proceed(args);
      }
      const t0 = process.hrtime.bigint();
      const start = performance.now();
      const run = () => proceed(args);
      if (opts.wrapProceed) {
        const result = await opts.wrapProceed(`sql:db·${model}.${operation}`, run);
        opts.onResult({
          model,
          operation,
          ms: performance.now() - start,
          execMs: engine.claimExecMs(t0, process.hrtime.bigint()),
          atMs: start,
          args,
        });
        return result;
      }
      const result = await run();
      opts.onResult({
        model,
        operation,
        ms: performance.now() - start,
        execMs: engine.claimExecMs(t0, process.hrtime.bigint()),
        atMs: start,
        args,
      });
      return result;
    },
  });
}
