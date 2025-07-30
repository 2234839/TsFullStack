import { Context, Effect } from 'effect';
import type { PrismaClient as PrismaClientType } from '@zenstackhq/runtime';
import { PrismaClient, type Prisma } from '@prisma/client';
import { enhance } from '@zenstackhq/runtime/edge';
import __ModelMeta from '@zenstackhq/runtime/model-meta';
import { modelsName } from '../db/model-meta';
import { MsgError } from '../util/error';

/** 是否开启数据库调试日志   */
const DB_DEBUG = false;

/** 只允许这些方法通过代理访问, 默认为 $transaction 和对应的表,ZenStack 不接受 $transaction 数组形式的调用，客户端又没法使用非数组形式，所以不让用 */
export const allowedMethods = ['$transaction', ...modelsName] as const;
export type safePrisma = Pick<PrismaClientType, (typeof allowedMethods)[number]>;

export class PrismaService extends Context.Tag('PrismaService')<
  PrismaService,
  {
    /** 原始 Prisma 客户端实例 */
    readonly prisma: PrismaClient;
    /** 获取zenstack 生成的增强 Prisma 客户端实例，用于鉴权操作
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
        user: Omit<
          Prisma.UserGetPayload<{ include: { role: true; userSession: true } }>,
          'password'
        >;
      },
      MsgError,
      PrismaService
    >;
  }
>() {}

export const PrismaServiceLive = PrismaService.of({
  prisma: new PrismaClient({ log: ['info'] }),
  getPrisma: (opt: {
    userId?: string;
    email?: string;
    sessionToken?: string;
    sessionID?: number;
  }) =>
    Effect.gen(function* () {
      const { prisma } = yield* PrismaService;

      if (Object.values(opt).filter((el) => el).length === 0) {
        yield* Effect.fail(MsgError.msg('Invalid options'));
      }
      let where = {} as Prisma.UserWhereInput;
      if (opt.sessionToken) {
        where.userSession = { some: { token: opt.sessionToken, expiresAt: { gt: new Date() } } };
      } else if (opt.sessionID) {
        where.userSession = { some: { id: opt.sessionID, expiresAt: { gt: new Date() } } };
      } else if (opt.userId) {
        where.id = opt.userId;
      } else if (opt.email) {
        where.email = opt.email;
      } else {
        yield* Effect.fail(MsgError.msg('Invalid options'));
      }
      const user = yield* Effect.promise(() =>
        prisma.user.findFirst({
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
        }),
      );
      if (!user) {
        yield* Effect.fail(
          new MsgError(MsgError.op_toLogin, 'x_token_id is invalid or user not found'),
        );
      }
      const db = enhance(prisma, { user: user! }, { logPrismaQuery: DB_DEBUG });

      /** 代理对象，限制对 Prisma 客户端的访问方法  */
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
          password: undefined,
          created: user!.created,
          updated: user!.updated,
          avatar: user!.avatar,
          role: user!.role || [],
          userSession: user!.userSession || [],
        },
      };
    }),
});
