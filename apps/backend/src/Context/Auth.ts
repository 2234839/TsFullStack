import { Context, Effect } from 'effect';
import type { User, Role } from '../../.zenstack/models';
import type { DbClient } from './DbService';
import { MsgError } from '../util/error';

// 定义数据库返回类型
export interface Database {
  db: DbClient;
  user: Omit<User, 'password'> & { role: Role[]; userSession: UserSession[] };
}

/** 用户会话类型 */
interface UserSession {
  id: number;
  created: Date;
  updated: Date;
  userId: string;
  token: string;
  expiresAt: Date;
}

export class AuthContext extends Context.Tag('AuthContext')<
  AuthContext,
  {
    db: Database['db'];
    user: Database['user'];
  }
>() {}

function userIsAdmin(user: Database['user']) {
  return !!user.role?.find((el) => el.name === 'admin');
}

/** 检测当前登录的用户是否为超级管理员 */
export function authUserIsAdmin() {
  return Effect.gen(function* () {
    const auth = yield* AuthContext;
    return userIsAdmin(auth.user);
  });
}

/** 要求当前用户必须是管理员，否则抛出权限错误 */
export const requireAdmin = () =>
  Effect.gen(function* () {
    const isAdmin = yield* authUserIsAdmin();
    if (!isAdmin) {
      throw MsgError.msg('需要管理员权限');
    }
  });
