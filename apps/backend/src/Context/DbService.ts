import { definePlugin, ZenStackClient, type ClientContract } from '@zenstackhq/orm';
import { SqliteDialect } from '@zenstackhq/orm/dialects/sqlite';
import { PolicyPlugin } from '@zenstackhq/plugin-policy';
import Database from 'better-sqlite3';
import { Effect, Option } from 'effect';
import type { UserFindFirstArgs } from '../../.zenstack/input';
import type { Role, User, UserSession } from '../../.zenstack/models';
import { schema, type SchemaType } from '../../.zenstack/schema';
import { fail, neverReturn, MsgError } from '../util/error';
import { AppConfigService } from './AppConfig';
import { ReqCtxService } from './ReqCtx';

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
export type DbClient = ClientContract<SchemaType, {
    dialect: SqliteDialect;
}, {}, {}>

/** 模块级缓存的基础 ZenStackClient（无日志插件），整个应用生命周期只创建一次 */
let _cachedDbRaw: DbClient | null = null;
let _cachedDbPath: string | null = null;

/** 获取无权限检查的 dbClient，慎用！！ 使用时需要明确场景，避免权限系统被跳过 */
export const DbClientEffect: Effect.Effect<DbClient, MsgError, AppConfigService> = Effect.gen(function* () {
  const appConfig = yield* AppConfigService;
  const databasePath = appConfig.databasePath;

  // 惰性初始化：只在首次或数据库路径变化时重建（正常情况下路径不变）
  if (!_cachedDbRaw || _cachedDbPath !== databasePath) {
    _cachedDbRaw = new ZenStackClient(schema, {
      dialect: new SqliteDialect({
        database: new Database(databasePath),
      }),
    });
    _cachedDbPath = databasePath;
  }

  const ctx = yield* Effect.serviceOption(ReqCtxService); // 可选依赖：有 ctx 时挂载日志插件
  return _cachedDbRaw.$use(
    definePlugin({
      id: 'cost-logger',
      onQuery: async ({ model, operation, args, proceed }) => {
        const start = Date.now();
        const result = await proceed(args);
        if (model === 'SystemLog') {
          return result;
        }
        const logText = `sql ${Date.now() - start}ms > ${model}.${operation} ${sanitizeArgsForLog(args)}`;
        /** 因为 getDbClient 这个方法的使用是可以不强制依赖 ctx 的，所以这里使用可选依赖，并当 ctx 存在的时候才 */
        if (Option.isNone(ctx)) {
          // 任务队列场景无 ctx，跳过日志避免刷屏
        } else {
          ctx.value.log(logText);
        }
        return result;
      },
    }),
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
  Effect.gen(function* () {
    const dbClient = yield* DbClientEffect;

    // v3 中使用 PolicyPlugin 来增强客户端
    const authDb = dbClient.$use(new PolicyPlugin());
    const db = authDb.$setAuth(user);

    return db;
  });

/** 根据入参获取有权限检查的 dbClinet，慎用！！只应该在登录鉴权等场景使用，避免入参直接由用户传入 */
export const getDbAuthEffect = (opt: {
  userId?: string;
  email?: string;
  sessionToken?: string;
  sessionID?: number;
}) =>
  Effect.gen(function* () {
    if (Object.values(opt).filter((el) => el).length === 0) {
      yield* Effect.fail(new MsgError(MsgError.op_toLogin, 'Invalid options: 需要提供认证信息'));
      return neverReturn();
    }
    const ctx = yield* ReqCtxService;
    ctx.log('[DbService] getDbAuth: userId=' + (opt.userId ?? 'null') + ', hasSession=' + !!opt.sessionToken);
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
      yield* Effect.fail(MsgError.msg('Invalid options'));
      return neverReturn();
    }

    const dbClient = yield* DbClientEffect;
    const user = yield* Effect.tryPromise({
      try: () =>
        dbClient.user.findFirst({
          where,
          include: {
            role: true,
            userSession: {
              /** 只包含当前使用的 session，理论上只有一个，有多个返回结果时可能存在问题 */
              where: {
                token: opt.sessionToken,
                id: opt.sessionID,
                expiresAt: { gt: now },
              },
              /** 兜底处理，当使用 user.userSession[0] 时能够获取最新的 */
              orderBy: { expiresAt: 'desc' },
            },
          },
        }) as Promise<(User & { role: Role[]; userSession: UserSession[] }) | null>,
      catch: (e) => MsgError.msg('查询用户失败: ' + String(e)),
    });

    if (!user) {
      yield* Effect.fail(new MsgError(MsgError.op_logout, '用户登录状态失效'));
      return neverReturn();
    }

    // 使用统一的函数创建带权限的 db 客户端
    const db = yield* createAuthDbClient(user);

    return {
      db,
      user,
    };
  });
