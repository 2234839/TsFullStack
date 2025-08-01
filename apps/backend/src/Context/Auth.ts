import { Context } from 'effect';
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
