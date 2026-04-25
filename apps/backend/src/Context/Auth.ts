import { Context, Effect } from 'effect';
import type { User, Role, UserSession } from '../../.zenstack/models';
import type { DbClient } from './DbService';
import { fail } from '../util/error';
import { MSG } from '../util/constants';

/** 定义数据库返回类型 */
export interface Database {
  db: DbClient;
  user: Omit<User, 'password'> & { role: Role[]; userSession: UserSession[] };
}

export class AuthContext extends Context.Tag('AuthContext')<
  AuthContext,
  {
    db: Database['db'];
    user: Database['user'];
  }
>() {}

function userIsAdmin(user: Database['user']) {
  return Boolean(user.role?.find((el) => el.name === 'admin' /* ADMIN_ROLE_NAME — 避免循环依赖，此处保留字面值 */));
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
    if (!isAdmin) return yield* fail(MSG.REQUIRE_ADMIN);
  });
