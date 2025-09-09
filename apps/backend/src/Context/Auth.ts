import { Context, Effect } from 'effect';
import type { Prisma } from '@prisma/client';
import type { PrismaClient as PrismaClientType } from '@zenstackhq/runtime';

// 定义数据库返回类型
export interface Database {
  db: PrismaClientType;
  user: Omit<Prisma.UserGetPayload<{ include: { role: true; userSession: true } }>, 'password'>;
}

export class AuthContext extends Context.Tag('AuthContext')<
  AuthContext,
  {
    db: Database['db'];
    user: Database['user'];
  }
>() {}

export function userIsAdmin(user: Database['user']) {
  return !!user.role.find((el) => el.name === 'admin');
}

/** 检测当前登录的用户是否为超级管理员 */
export function authUserIsAdmin() {
  return Effect.gen(function* () {
    const auth = yield* AuthContext;
    return userIsAdmin(auth.user);
  });
}
