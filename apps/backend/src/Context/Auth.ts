import { Context, Effect, Option } from 'effect';
import type { User, Role, UserSession } from '../../.zenstack/models';
import type { DbClient } from './DbService';
import { fail } from '../util/error';
import { MSG } from '../util/constants';

/** 定义数据库返回类型 */
export interface Database {
  db: DbClient;
  user: Omit<User, 'password'> & { role: Role[]; userSession: UserSession[] };
}

export class AuthContext extends Context.Service<
  AuthContext,
  {
    db: Database['db'];
    user: Database['user'];
  }
>()('AuthContext') {}

function userIsAdmin(user: Database['user']) {
  return Boolean(user.role?.find((el) => el.name === 'admin' /* ADMIN_ROLE_NAME — 避免循环依赖，此处保留字面值 */));
}

/** 检测当前登录的用户是否为超级管理员 */
export function authUserIsAdmin() {
  return Effect.map(AuthContext, (auth) => userIsAdmin(auth.user));
}

/** 要求当前用户必须是管理员，否则抛出权限错误 */
export const requireAdmin = () =>
  Effect.flatMap(authUserIsAdmin(), (isAdmin) => (isAdmin ? Effect.void : fail(MSG.REQUIRE_ADMIN)));

/**
 * 可选登录态下取当前用户 ID：已登录返回 userId，未登录/匿名接口返回 null。
 * 免鉴权接口（OAuth 回调、树洞等）里判断「是否登录」统一走这里。
 */
export const optionalUserId = (): Effect.Effect<string | null> =>
  Effect.map(Effect.serviceOption(AuthContext), (opt) => (Option.isSome(opt) ? opt.value.user.id : null));
