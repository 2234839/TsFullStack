import { Context, Effect } from 'effect';
import { ZenStackClient, type ClientContract } from '@zenstackhq/orm';
import { SqliteDialect } from '@zenstackhq/orm/dialects/sqlite';
import { PolicyPlugin } from '@zenstackhq/plugin-policy';
import Database from 'better-sqlite3';
import { schema, type SchemaType } from '../../.zenstack/schema';
import type { User, UserSession, Role, Token, Task, Resource, TokenTransaction } from '../../.zenstack/models';
import type { UserFindFirstArgs } from '../../.zenstack/input';
import { modelsName } from '../db/model-meta';
import { MsgError } from '../util/error';
import { AppConfigService } from './AppConfig';

/** 是否开启数据库调试日志   */
const DB_DEBUG = false;

/** 只允许这些方法通过代理访问, 默认为 $transaction 和对应的表,ZenStack 不接受 $transaction 数组形式的调用，客户端又没法使用非数组形式，所以不让用 */
export const allowedMethods = ['$transaction', ...modelsName] as const;
type DbClient = ClientContract<SchemaType>;
export type safePrisma = Pick<DbClient, (typeof allowedMethods)[number]>;
export class DbService extends Context.Tag('DbService')<
  DbService,
  {
    /** 原始 ZenStack ORM 客户端实例（无权限控制） */
    readonly dbClient: ClientContract<typeof schema>;
    /** 获取zenstack 生成的增强 ORM 客户端实例，用于鉴权操作
     *  ！！这个方法的入参是可以用于获取任意帐号的 prisma 实例，因此需要谨慎使用
     */
    readonly getPrisma: (opt: {
      userId?: string;
      email?: string;
      sessionToken?: string;
      sessionID?: number;
    }) => Effect.Effect<
      {
        db: safePrisma;
        user: Omit<User, 'password'> & { role: Role[]; userSession: UserSession[] };
      },
      MsgError,
      DbService
    >;
  }
>() {}

export const DbServiceLive = Effect.gen(function* () {
  const appConfig = yield* AppConfigService;

  /** 数据库路径从配置文件读取 */
  const databasePath = appConfig.databasePath;
  console.log('[databasePath]',databasePath);
  const dbClient = new ZenStackClient(schema, {
    dialect: new SqliteDialect({
      database: new Database(databasePath),
    }),
    log: DB_DEBUG ? ['query', 'error'] : undefined,
  });

  return DbService.of({
    dbClient,
    getPrisma: (opt: {
      userId?: string;
      email?: string;
      sessionToken?: string;
      sessionID?: number;
    }) =>
      Effect.gen(function* () {
        if (Object.values(opt).filter((el) => el).length === 0) {
          yield* Effect.fail(new MsgError(MsgError.op_toLogin, 'Invalid options: 需要提供认证信息'));
        }

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
          yield* Effect.fail(new MsgError(MsgError.op_logout, '用户登录状态失效'));
        }

        // v3 中使用 PolicyPlugin 来增强客户端
        const authDb = dbClient.$use(new PolicyPlugin());
        const db = authDb.$setAuth(user!);

        /** 代理对象，限制对 ORM 客户端的访问方法  */
        const dbProxy = new Proxy(db, {
          get(target, prop: string | symbol, receiver) {
            if (typeof prop === 'string' && !allowedMethods.includes(prop as any)) {
              throw new MsgError(MsgError.op_msgError, `Method '${prop}' is not allowed.`);
            }
            return Reflect.get(target, prop, receiver);
          },
        }) as safePrisma;

        return {
          db: dbProxy,
          user: {
            id: user!.id,
            email: user!.email,
            created: user!.created,
            updated: user!.updated,
            avatar: user!.avatar,
            role: user!.role || [],
            userSession: user!.userSession || [],
          },
        };
      }),
  });
});
