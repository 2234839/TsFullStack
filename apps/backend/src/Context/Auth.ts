import { Context, Effect } from 'effect';
import type { User, Role } from '../../.zenstack/models';
import type { safePrisma } from './DbService';

// 定义数据库返回类型
export interface Database {
  db: safePrisma;
  user: Omit<User, 'password'> & { role: Role[]; userSession: any[] };
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
