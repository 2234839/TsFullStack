import { PrismaClient } from '../../prisma/client';
import type { PrismaClient as PrismaClientType } from '@zenstackhq/runtime';
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
export async function getPrisma(opt: { userId?: string; email?: string; x_token_id?: string }) {
  if (Object.values(opt).filter((el) => el).length === 0) {
    throw new MsgError(MsgError.op_msgError, 'Invalid options');
  }
  let where = {} as any;
  if (opt.x_token_id) {
    where.userSession = { some: { token: opt.x_token_id } };
  } else if (opt.userId) {
    where.id = opt.userId;
  } else if (opt.email) {
    where.email = opt.email;
  }

  const user = await prisma.user.findFirst({
    where: where,
    include: {
      role: true,
    },
  });
  if (!user) {
    throw new MsgError(MsgError.op_toLogin, 'User not found');
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
