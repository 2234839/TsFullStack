import { definePlugin, ZenStackClient, type ClientContract } from '@zenstackhq/orm';
import { SqliteDialect } from '@zenstackhq/orm/dialects/sqlite';
import { PolicyPlugin } from '@zenstackhq/plugin-policy';
import Database from 'better-sqlite3';
import { Effect, Option } from 'effect';
import type { UserFindFirstArgs } from '../../.zenstack/input';
import type { Role, User, UserSession } from '../../.zenstack/models';
import { schema, type SchemaType } from '../../.zenstack/schema';
import { modelsName } from '../db/model-meta';
import { MsgError } from '../util/error';
import { AppConfigService } from './AppConfig';
import { ReqCtxService } from './ReqCtx';

/** 只允许这些方法通过代理访问, 默认为 $transaction 和对应的表,ZenStack 不接受 $transaction 数组形式的调用，客户端又没法使用非数组形式，所以不让用 */
export const allowedMethods = ['$transaction', ...modelsName] as const;
type DbClient = ClientContract<SchemaType, {
    dialect: SqliteDialect;
}, {}, {}>
const a = {} as unknown as DbClient;
a.resource
export type safePrisma = Pick<DbClient, (typeof allowedMethods)[number]>;

/** 获取无权限检查的 dbClient，慎用！！ 使用时需要明确场景，避免权限系统被跳过 */
export const DbClientEffect = Effect.gen(function* () {
  const appConfig = yield* AppConfigService;
  /** 数据库路径从配置文件读取 */
  const databasePath = appConfig.databasePath;

  const dbRaw = new ZenStackClient(schema, {
    dialect: new SqliteDialect({
      database: new Database(databasePath),
    }),
  });
  const ctx = yield* Effect.serviceOption(ReqCtxService);
  const DbClient = dbRaw.$use(
    definePlugin({
      id: 'cost-logger',
      onQuery: async ({ model, operation, args, proceed }) => {
        const start = Date.now();
        const result = await proceed(args);
        if (model === 'SystemLog') {
          return result;
        }
        const logText = `sql ${Date.now() - start}ms > ${model}.${operation} ${JSON.stringify(args)}`;
        /** 因为 getDbClient 这个方法的使用是可以不强制依赖 ctx 的，所以这里使用可选依赖，并当 ctx 存在的时候才 */
        if (Option.isNone(ctx)) {
          // 因为任务队列会一直在执行，所以会导致这里日志特别多，在想到好方法之前这里先注释掉了，后续可以考虑增加一个日志级别的配置项来控制是否输出这类日志
          // console.log('[no ctx sql call]' + logText);
        } else {
          ctx.value.log(logText);
        }
        return result;
      },
    }),
  );
  return DbClient;
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

    return db
    // 升级v3后发现会报 interactiveTransaction 等方法的调用，很奇怪，因为我没有在顶层调用这些方法
    // TODO 以后 还是要进行安全升级，暂时先注释
    // /** 代理对象，限制对 ORM 客户端的访问方法  */
    // const dbProxy = new Proxy(db, {
    //   get(target, prop: string | symbol, receiver) {
    //     console.log('[prop]',target === db,prop);
    //     if (target === db && typeof prop === 'string' && !allowedMethods.includes(prop as any)) {
    //       throw new MsgError(MsgError.op_msgError, `Method '${prop}' is not allowed.`);
    //     }
    //     return Reflect.get(target, prop, receiver);
    //   },
    // }) as safePrisma;

    // return dbProxy;
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
    }
    const ctx = yield* ReqCtxService;
    ctx.log('getDbAuth：' + JSON.stringify(opt));
    // 构建 where 条件 - v3 中使用生成的 input 类型
    let where: UserFindFirstArgs['where'] = {};
    if (opt.sessionToken) {
      where = {
        userSession: { some: { token: opt.sessionToken, expiresAt: { gt: new Date() } } },
      };
    } else if (opt.sessionID) {
      where = {
        userSession: { some: { id: opt.sessionID, expiresAt: { gt: new Date() } } },
      };
    } else if (opt.userId) {
      where = { id: opt.userId };
    } else if (opt.email) {
      where = { email: opt.email };
    } else {
      yield* Effect.fail(MsgError.msg('Invalid options'));
    }
    const dbClient = yield* DbClientEffect;
    const user = yield* Effect.promise(
      () =>
        dbClient.user.findFirst({
          where,
          include: {
            role: true,
            userSession: {
              /** 只包含当前使用的 session，理论上只有一个，有多个返回结果时可能存在问题 */
              where: {
                token: opt.sessionToken,
                id: opt.sessionID,
                expiresAt: { gt: new Date() },
              },
              /** 兜底处理，当使用 user.userSession[0] 时能够获取最新的 */
              orderBy: { expiresAt: 'desc' },
            },
          },
        }) as Promise<(User & { role: Role[]; userSession: UserSession[] }) | null>,
    );

    if (!user) {
      throw new MsgError(MsgError.op_logout, '用户登录状态失效');
    }

    // 使用统一的函数创建带权限的 db 客户端
    const db = yield* createAuthDbClient(user);

    return {
      db,
      user,
    };
  });
