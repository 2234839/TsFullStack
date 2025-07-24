import type { PrismaClient as PrismaClientType } from '@zenstackhq/runtime';
import { PrismaClient, type Prisma } from '@prisma/client';
import { enhance } from '@zenstackhq/runtime/edge';
import __ModelMeta from '@zenstackhq/runtime/model-meta';
import { modelsName } from './model-meta';
import { MsgError } from '../util/error';

/** 是否开启数据库调试日志   */
const DB_DEBUG = false;

/** 尽量不要使用这个对象，除非你确定不需要鉴权。否则应该使用 getPrisma 函数 */
export const prisma = new PrismaClient({ log: ['info'] });

/** 只允许这些方法通过代理访问, 默认为 $transaction 和对应的表,ZenStack 不接受 $transaction 数组形式的调用，客户端又没法使用非数组形式，所以不让用 */
export const allowedMethods = ['$transaction', ...modelsName] as const;
export type safePrisma = Pick<PrismaClientType, (typeof allowedMethods)[number]>;
/** 获取zenstack 生成的增强 Prisma 客户端实例，用于鉴权操作
 *  ！！这个方法的入参是可以用于获取任意帐号的 prisma 实例，因此需要谨慎使用
 */
export async function getPrisma(opt: {
  userId?: string;
  email?: string;
  sessionToken?: string;
  sessionID?: number;
}) {
  if (Object.values(opt).filter((el) => el).length === 0) {
    throw MsgError.msg('Invalid options');
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
    throw MsgError.msg('Invalid options');
  }
  const user = await prisma.user.findFirst({
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
  });
  if (!user) {
    throw new MsgError(MsgError.op_toLogin, 'x_token_id is invalid or user not found');
  }
  const db = enhance(prisma, { user }, { logPrismaQuery: DB_DEBUG });

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
      ...user,
      /** 移除密码字段，避免泄露敏感信息   */
      password: undefined,
    },
  };
}
