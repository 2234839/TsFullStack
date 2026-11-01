/**
 * 数据库客户端上下文（可切换 worker_threads / 进程内直连）。
 *
 * 开关：config.json 的 `dbWorker`（缺省 = true 开启）。
 * - true（默认）：真实客户端跑在 dbWorker 线程（./dbWorker/workerEntry.ts），
 *   本模块产出「与 ZenStack DbClient 同类型」的透明代理（./dbWorker/DbWorkerClient.ts），
 *   主线程不被同步 SQLite 阻塞；交互式 $transaction 的回调留在主线程，操作凭 txId 路由。
 * - false：进程内直连（./dbWorker/localDb.ts），等价于 worker 化之前的原行为（单文件零线程模式）。
 *
 * 两种模式共享装配与观测原语（./dbWorker/dbCore.ts），业务代码与诊断链路行为一致：
 * - 行级权限（PolicyPlugin + $setAuth）、软删除插件、cost-logger 观测
 * - 诊断快照（snapshotDriverTimings）在两种模式下都可用
 */
import { Effect, Option } from 'effect';
import type { UserFindFirstArgs } from '../../.zenstack/input';
import type { Role, User, UserSession } from '../../.zenstack/models';
import { fail, MsgError, LogoutError, ToLoginError, tryOrFail } from '../util/error';
import { MSG } from '../util/constants';
import { AppConfigService } from './AppConfig';
import { ReqCtxService, type ReqCtx } from './ReqCtx';
import { getDbWorker } from './dbWorker/DbWorkerClient';
import { getLocalDbClient, deriveLocalAuthClient, snapshotLocalDriverTimings } from './dbWorker/localDb';
import type { CoreDriverTiming } from './dbWorker/dbCore';
import type { WorkerDbClient } from './dbWorker/clientType';

/**
 * 完整的数据库客户端类型。
 *
 * worker 模式下运行时它是代理（Proxy），直连模式下是真实 ZenStack 客户端；
 * 类型上都是 ClientContract，业务代码的写法两种模式完全一致。
 */
export type DbClient = WorkerDbClient;

/** 驱动层语句执行记录（atMs 为本进程 performance.now 时基毫秒；worker 模式已换算回主线程时基） */
export type DriverTiming = CoreDriverTiming;

/** 最近一次 DbClientEffect 评估到的运行模式与路径（诊断快照复用；配置在进程内不变） */
let _lastMode: boolean | null = null;
let _lastPath: string | null = null;

/**
 * 获取无权限检查的 dbClient，慎用！！ 使用时需要明确场景，避免权限系统被跳过
 */
export const DbClientEffect: Effect.Effect<DbClient, MsgError, AppConfigService> = Effect.gen(function* () {
  const appConfig = yield* AppConfigService;
  const useWorker = appConfig.dbWorker !== false;
  const ctx = yield* Effect.serviceOption(ReqCtxService);
  const reqCtx = Option.isNone(ctx) ? undefined : (ctx.value as ReqCtx);
  _lastMode = useWorker;
  _lastPath = appConfig.databasePath;

  if (!useWorker) {
    /** 直连模式：本地客户端（事务/插件均为 ZenStack 原生行为） */
    return getLocalDbClient(appConfig.databasePath, reqCtx);
  }

  /** worker 模式：代理客户端（$setAuth/$transaction 由代理拦截，观测随响应回灌 reqCtx） */
  const sessionPromise = getDbWorker(appConfig.databasePath);
  const session = yield* Effect.promise(() => sessionPromise);
  return session.proxyFor('base', reqCtx);
});

/**
 * 慢请求诊断：快照驱动层语句执行记录。
 *
 * 按当前模式分派（直连=同步快照；worker=跨线程快照+时钟换算），统一异步签名，调用方无感。
 */
export async function snapshotDriverTimings(fromMs: number, toMs: number): Promise<DriverTiming[]> {
  /** 尚无任何 DB 访问 = 无驱动语句可快照 */
  if (_lastMode === null || _lastPath === null) return [];
  if (!_lastMode) return snapshotLocalDriverTimings(fromMs, toMs);
  const session = await getDbWorker(_lastPath);
  return session.snapshotDriverTimings(fromMs, toMs);
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
      dbClient.diagTrace.create({ data: { ...row, timeline: row.timeline as never } as never }),
    );
  });

/**
 * 根据用户对象创建带权限检查的 db 客户端
 *
 * worker 模式：$setAuth 由代理拦截，请求 worker 派生（PolicyPlugin + $setAuth）客户端并按 user 缓存；
 * 直连模式：本地派生（validator 共享）。
 */
export const createAuthDbClient = (
  user:
    | (User & { role: Role[]; userSession: UserSession[] })
    | (Omit<User, 'password'> & { role: Role[]; userSession: UserSession[] }),
): Effect.Effect<DbClient, MsgError, AppConfigService> =>
  Effect.gen(function* () {
    const appConfig = yield* AppConfigService;
    if (appConfig.dbWorker === false) {
      const ctx = yield* Effect.serviceOption(ReqCtxService);
      const reqCtx = Option.isNone(ctx) ? undefined : (ctx.value as ReqCtx);
      return deriveLocalAuthClient(appConfig.databasePath, user, reqCtx);
    }
    const dbClient = yield* DbClientEffect;
    return dbClient.$setAuth(user);
  });

/** 根据入参获取有权限检查的 dbClinet，慎用！！只应该在登录鉴权等场景使用，避免入参直接由用户传入 */
export const getDbAuthEffect = (opt: {
  userId?: string;
  email?: string;
  sessionToken?: string;
  sessionID?: number;
}): Effect.Effect<
  { db: DbClient; user: User & { role: Role[]; userSession: UserSession[] } },
  MsgError | LogoutError | ToLoginError,
  AppConfigService | ReqCtxService
> =>
  Effect.gen(function* () {
    if (!Object.values(opt).some(Boolean)) {
      return yield* Effect.fail(ToLoginError.msg('Invalid options: 需要提供认证信息'));
    }
    const ctx = yield* ReqCtxService;
    ctx.log(`[DbService] getDbAuth: userId=${opt.userId ?? 'null'}, hasSession=${!!opt.sessionToken}`);
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
