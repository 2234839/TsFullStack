import { definePlugin, InputValidator, ZenStackClient, type ClientContract } from '@zenstackhq/orm';
import { SqliteDialect } from '@zenstackhq/orm/dialects/sqlite';
import { PolicyPlugin } from '@zenstackhq/plugin-policy';
import { SoftDeletePlugin } from '@zenstackhq/plugin-soft-delete';
import Database from 'better-sqlite3';
import { Context, Effect, Exit, Option } from 'effect';
import type { UserFindFirstArgs } from '../../.zenstack/input';
import type { Role, User, UserSession } from '../../.zenstack/models';
import { schema, type SchemaType } from '../../.zenstack/schema';
import { fail, MsgError, LogoutError, ToLoginError, tryOrFail } from '../util/error';
import { MSG } from '../util/constants';
import { AppConfigService } from './AppConfig';
import { ReqCtxService, type ReqCtx } from './ReqCtx';

/** 日志前缀 */
const LOG_PREFIX = '[DbService]';

/** 需要脱敏的敏感字段名 */
const SENSITIVE_FIELDS = ['apiKey', 'password', 'token', 'clientSecret', 'sessionToken'] as const;

/** 对数据库操作参数进行脱敏，防止日志泄露 apiKey、password、token 等敏感信息 */
function sanitizeArgsForLog(args: Record<string, unknown> | undefined): string {
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

/** 完整的数据库客户端类型 */
export type DbClient = ClientContract<
  SchemaType,
  {
    dialect: SqliteDialect;
  },
  {},
  {}
>;

/** 模块级缓存的基础 ZenStackClient（无日志插件），整个应用生命周期只创建一次 */
let _cachedDbRaw: DbClient | null = null;
let _cachedDbPath: string | null = null;
/** 无日志插件的客户端缓存（任务队列场景复用，避免重复 $use） */
let _cachedDbNoLog: DbClient | null = null;
/** 底层 better-sqlite3 连接实例，用于路径变化时正确关闭 */
let _cachedDatabase: InstanceType<typeof Database> | null = null;

/** 驱动层真实执行计时记录（better-sqlite3 同步执行，语句之间不会交错） */
interface DriverTiming {
  /** 语句注释 id（/*sN*\/ 前缀），全局唯一，供 onQuery 认领 */
  id: number;
  /** 语句开始，相对进程启动的毫秒（hrtime.bigint()/1e6，与 performance.now 同基） */
  atMs: number;
  /** 语句耗时 ms */
  ms: number;
  /** 语句 SQL 文本（带注释 id 前缀） */
  sql: string;
  /** 是否已被某条 onQuery 认领（认领后不再重复计入其他查询） */
  claimed: boolean;
}

/** 进程级驱动计时缓冲（环形，溢出丢最旧）；onQuery 按时间窗认领，请求结束快照进诊断时间线 */
const _driverTimings: DriverTiming[] = [];
const DRIVER_TIMINGS_CAP = 2000;
/** 语句注释 id 自增序号 */
let _stmtSeq = 0;

/** 统计一条语句执行，写入缓冲 */
function recordDriverTiming(id: number, sql: string, fn: () => unknown): unknown {
  const start = process.hrtime.bigint();
  try {
    return fn();
  } finally {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (_driverTimings.length >= DRIVER_TIMINGS_CAP) _driverTimings.splice(0, 500);
    _driverTimings.push({ id, atMs: Number(start) / 1e6, ms, sql, claimed: false });
  }
}

/** 给 better-sqlite3 语句包计时；SQL 开头已注入注释 id（prepare 时改写），语句凭 id 被唯一认领 */
function timeStatement(id: number, stmt: { source?: string } & Record<string, unknown>): unknown {
  const sql: string = stmt.source ?? '';
  for (const m of ['get', 'all', 'run', 'iterate'] as const) {
    const raw = (stmt as Record<string, ((...a: unknown[]) => unknown) | undefined>)[m]?.bind(stmt);
    if (!raw) continue;
    stmt[m] = (...args: unknown[]) => recordDriverTiming(id, sql, () => raw(...args));
  }
  return stmt;
}

function withDriverTiming(db: InstanceType<typeof Database>): InstanceType<typeof Database> {
  const rawPrepare = db.prepare.bind(db) as unknown as (sql: string) => { source?: string } & Record<string, unknown>;
  /** 改写 SQL：开头注入注释 id（SQLite 支持 /* 注释），让驱动层语句可被 onQuery 唯一认领 */
  (db as unknown as Record<string, unknown>).prepare = (sqlArg: unknown) => {
    const id = ++_stmtSeq;
    const stmt = rawPrepare(`/*s${id}*/ ${String(sqlArg)}`);
    return timeStatement(id, stmt);
  };
  return db;
}

/** 认领 [t0, t1]（hrtime 纳秒）窗口内的未认领驱动语句，返回真实执行总耗时 ms；认领后语句不再计入其他查询。查询嵌套时内层先认领（先结束先认领），外层拿到的是剔除内层后的剩余 */
function claimDriverExecMs(t0: bigint, t1: bigint): number {
  const w0 = Number(t0) / 1e6;
  const w1 = Number(t1) / 1e6;
  let total = 0;
  for (const t of _driverTimings) {
    if (t.claimed) continue;
    /** 语句开始落在窗口内即认领（better-sqlite3 同步执行，语句不会跨查询边界） */
    if (t.atMs >= w0 && t.atMs <= w1) {
      t.claimed = true;
      total += t.ms;
    }
  }
  return total;
}

/** 快照 [fromMs, toMs]（相对进程启动，与 performance.now 同基）窗口内的驱动层语句执行记录，供诊断时间线展示真实执行耗时 */
export function snapshotDriverTimings(fromMs: number, toMs: number): DriverTiming[] {
  const rest: DriverTiming[] = [];
  const hits: DriverTiming[] = [];
  for (const t of _driverTimings) {
    if (t.atMs < fromMs) continue;
    if (t.atMs > toMs + 1000) rest.push(t);
    else hits.push(t);
  }
  _driverTimings.length = 0;
  _driverTimings.push(...rest);
  return hits;
}

/** 获取无权限检查的 dbClient，慎用！！ 使用时需要明确场景，避免权限系统被跳过 */
export const DbClientEffect: Effect.Effect<DbClient, MsgError, AppConfigService> = Effect.gen(function* () {
  const appConfig = yield* AppConfigService;
  const databasePath = appConfig.databasePath;

  // 惰性初始化：只在首次或数据库路径变化时重建（正常情况下路径不变）
  if (!_cachedDbRaw || _cachedDbPath !== databasePath) {
    /** 路径变化时关闭旧连接，释放文件描述符 */
    if (_cachedDatabase) {
      _cachedDatabase.close();
      _cachedDatabase = null;
    }
    const db = withDriverTiming(new Database(databasePath));
    _cachedDatabase = db;
    _cachedDbRaw = new ZenStackClient(schema, {
      dialect: new SqliteDialect({ database: db }),
    })
      /** 软删除：拦截 Kysely 查询，delete→墓碑时间戳，读取自动过滤，只对 @deletedAt 模型生效 */
      .$use(new SoftDeletePlugin());
    _cachedDbPath = databasePath;
    _cachedDbNoLog = null;
  }

  const ctx = yield* Effect.serviceOption(ReqCtxService);

  /** 无 ctx 时复用缓存的客户端，避免每次调用都创建 $use 包装 */
  if (Option.isNone(ctx)) {
    if (!_cachedDbNoLog) {
      const noLog = _cachedDbRaw.$use(
        definePlugin({
          id: 'cost-logger',
          onQuery: async ({ args, proceed }) => proceed(args),
        }),
      );
      shareInputValidator(_cachedDbRaw, noLog);
      _cachedDbNoLog = noLog;
    }
    return _cachedDbNoLog;
  }

  return withCostLogger(_cachedDbRaw, ctx.value);
});

/**
 * ZenStack 客户端实现上持有的输入校验器（公开导出的 InputValidator，但字段不在 ClientContract 类型面上）
 */
interface ValidatorHolder {
  inputValidator: InputValidator<SchemaType>;
}

/** 运行时断言窄化：ZenStack 的 ClientImpl 实际都有 inputValidator 字段（含类型以获得成员检查） */
const asValidatorHolder = (client: DbClient): ValidatorHolder => client as unknown as ValidatorHolder;

/**
 * 共享基座客户端的 InputValidator 到派生客户端。
 *
 * ZenStack 的 ClientImpl 构造函数本来就继承父客户端的 validator，但 $use/$setAuth 路径
 * 会强制 new 一个新的（其 zod schema 缓存是实例字段，新实例首查重编译，实测 20~50ms），
 * 使每条 SQL 都背上这笔固定开销；validator 只依赖 schema 与校验开关、与插件/auth 无关，
 * 共享安全（实测查询从 ~35ms 降到 ~2ms）。
 */
function shareInputValidator(base: DbClient, derived: DbClient): void {
  asValidatorHolder(derived).inputValidator = asValidatorHolder(base).inputValidator;
}

function withCostLogger(base: DbClient, reqCtx: ReqCtx): DbClient {
  const client = base.$use(
    definePlugin({
      id: 'cost-logger',
      onQuery: async ({ model, operation, args, proceed }) => {
        const collector = reqCtx.spanCollector;
        /** 诊断自身模型不进统计也不建 span，避免诊断污染诊断 */
        if (!collector || model === 'SystemLog' || model === 'DiagTrace') {
          return proceed(args);
        }
        const start = Date.now();
        /** 窗口计时用 hrtime（与驱动计时同基），语句凭注释 id 被唯一认领 */
        const t0 = process.hrtime.bigint();
        /** 先挂根 span 保证入采集链，组树阶段会按时间区间重定到真正包裹它的业务 span（裸回调读不到 fiber context） */
        const parent = collector.rootSpan;
        const now = collector.nowNanos();
        const span = collector.tracer.span({
          name: `sql:db·${model}.${operation}`,
          startTime: now,
          parent: parent ? Option.some(parent) : Option.none(),
          annotations: Context.empty(),
          links: [],
          kind: 'internal',
          root: !parent,
          sampled: true,
        });
        let result: Awaited<ReturnType<typeof proceed>>;
        try {
          result = await proceed(args);
        } catch (error) {
          span.end(collector.nowNanos(), Exit.fail(error));
          throw error;
        }
        span.end(collector.nowNanos(), Exit.succeed(undefined));
        const ms = Date.now() - start;
        /** 认领窗口内未认领的驱动语句：execMs 为真实 SQL 执行耗时，ms - execMs 即 ORM 校验/建查询开销 */
        const execMs = claimDriverExecMs(t0, process.hrtime.bigint());
        const logText = `sql ${ms}ms (exec ${Math.round(execMs * 100) / 100}ms) > ${model}.${operation} ${sanitizeArgsForLog(args)}`;
        reqCtx.log(logText);
        /** 结构化 SQL 明细，供慢请求诊断时间线使用 */
        reqCtx.sqlEvents.push({
          model,
          operation,
          ms,
          /** 驱动层真实执行耗时，ms-execMs 即 ZenStack 包装开销 */
          execMs: Math.round(execMs * 100) / 100,
          at: Math.round(performance.now() - reqCtx.t0),
        });
        return result;
      },
    }),
  );
  shareInputValidator(base, client);
  return client;
}

/**
 * 慢请求诊断追踪落盘。
 *
 * 只在请求超过慢阈值时由 server/index.ts 调用（fire-and-forget fork），
 * 表仅追加不读取于业务链路，查询走 diagApi（管理员接口）。
 */
export const insertDiagTrace = (row: {
  method: string;
  totalMs: number;
  queueWaitMs: number;
  authMs?: number;
  sqlCount: number;
  sqlTotalMs: number;
  sqlMaxMs: number;
  loopLagMaxMs: number;
  timeline: unknown;
}) =>
  Effect.gen(function* () {
    const dbClient = yield* DbClientEffect;
    yield* tryOrFail('诊断落盘', () =>
      dbClient.diagTrace.create({ data: { ...row, timeline: row.timeline as never } }),
    );
  });

/**
 * 根据用户对象创建带权限检查的 db 客户端
 *
 * 这个函数将用户数据转换为带权限控制的数据库客户端
 * 每次调用都会创建新的客户端，确保有正确的 ReqCtxService（用于日志追踪）
 *
 * @param user - 用户对象，包含角色和会话信息（可以不包含 password）
 * @returns 带权限控制的 db 客户端 Effect
 */
export const createAuthDbClient = (
  user:
    | (User & { role: Role[]; userSession: UserSession[] })
    | (Omit<User, 'password'> & { role: Role[]; userSession: UserSession[] }),
) =>
  Effect.map(DbClientEffect, (dbClient) => {
    /** $use(PolicyPlugin) 与 $setAuth 各派生一次客户端，两次都要共享 validator，否则每请求业务 SQL 仍背冷编译税 */
    const withPolicy = dbClient.$use(new PolicyPlugin());
    shareInputValidator(dbClient, withPolicy);
    const authed = withPolicy.$setAuth(user);
    shareInputValidator(withPolicy, authed);
    return authed;
  });

/** 根据入参获取有权限检查的 dbClinet，慎用！！只应该在登录鉴权等场景使用，避免入参直接由用户传入 */
export const getDbAuthEffect = (opt: { userId?: string; email?: string; sessionToken?: string; sessionID?: number }) =>
  Effect.gen(function* () {
    if (!Object.values(opt).some(Boolean)) {
      return yield* Effect.fail(ToLoginError.msg('Invalid options: 需要提供认证信息'));
    }
    const ctx = yield* ReqCtxService;
    ctx.log(`${LOG_PREFIX} getDbAuth: userId=${opt.userId ?? 'null'}, hasSession=${!!opt.sessionToken}`);
    /** 统一时间基准，避免多次 new Date() 导致边界条件不一致 */
    const now = new Date();
    // 构建 where 条件 - v3 中使用生成的 input 类型
    let where: UserFindFirstArgs['where'] = {};
    if (opt.sessionToken) {
      where = {
        userSession: { some: { token: opt.sessionToken, expiresAt: { gt: now } } },
      };
    } else if (opt.sessionID) {
      where = {
        userSession: { some: { id: opt.sessionID, expiresAt: { gt: now } } },
      };
    } else if (opt.userId) {
      where = { id: opt.userId };
    } else if (opt.email) {
      where = { email: opt.email };
    } else {
      return yield* fail(MSG.INVALID_QUERY_OPTIONS);
    }

    const dbClient = yield* DbClientEffect;
    /** 查询参数提取为独立常量，避免内联对象字面量触发 MapType 深度递归比较 */
    const findFirstArgs = {
      where,
      include: {
        role: true,
        userSession: {
          /** 只包含当前使用的 session，理论上只有一个，有多个返回结果时可能存在问题 */
          where: {
            ...(opt.sessionToken != null && { token: opt.sessionToken }),
            ...(opt.sessionID != null && { id: opt.sessionID }),
            expiresAt: { gt: now },
          },
          /** 兜底处理，当使用 user.userSession[0] 时能够获取最新的 */
          orderBy: { expiresAt: 'desc' },
        },
      },
    } satisfies UserFindFirstArgs;
    const user = yield* Effect.withSpan(
      tryOrFail(
        '查询用户',
        () =>
          dbClient.user.findFirst(findFirstArgs) as unknown as Promise<
            (User & { role: Role[]; userSession: UserSession[] }) | null
          >,
      ),
      'sql:auth·鉴权用户会话查询',
    );

    if (!user) {
      return yield* Effect.fail(LogoutError.msg('用户登录状态失效'));
    }

    /** 使用统一的函数创建带权限的 db 客户端 */
    const db = yield* createAuthDbClient(user);

    return {
      db,
      user,
    };
  });
