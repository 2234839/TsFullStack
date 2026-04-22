import { compare, hash } from 'bcryptjs';
import { Effect } from 'effect';
import { DbClientEffect } from '../Context/DbService';
import { ReqCtxService } from '../Context/ReqCtx';
import { dbTry, dbTryOrDefault } from '../util/dbEffect';
import { MsgError } from '../util/error';
import { genUserSession } from './appApi/_genUserSession';
import { fileApi } from './appApi/file';
import { githubApi } from './appApi/github';
import { shareApi } from './appApi/share';
import { treeholeApi } from './appApi/treehole';

async function randomDelay(baseDelay = 500) {
  await new Promise((r) => setTimeout(r, baseDelay + 2_000 * Math.random()));
}
/** 无需鉴权的 api */
export const appApis = {
  system: {
    async register(email: string, password: string) {
      await randomDelay();
      return Effect.gen(function* () {
        const dbClient = yield* DbClientEffect;
        // throw MsgError.msg('暂时关闭了直接注册帐号，请使用其他方式登录！ ');

        const user = yield* dbTryOrDefault('[AppApi]', '查询用户', () =>
          dbClient.user.findUnique({
            where: { email },
          }),
          null,
        );
        if (user) {
          throw MsgError.msg('用户已存在');
        }
        /** 对密码进行哈希处理（异步，避免阻塞事件循环） */
        const hashedPassword = yield* Effect.tryPromise({
          try: () => hash(password, 10),
          catch: () => MsgError.msg('密码哈希处理失败'),
        });
        const newUser = yield* dbTry('[AppApi]', '创建用户', () =>
          dbClient.user.create({
            data: { email, password: hashedPassword },
          }),
        );
        const ctx = yield* ReqCtxService;
        ctx.log('[AppApi] register user', newUser.id);
        return newUser;
      });
    },
    async loginByEmailPwd(email: string, password: string) {
      await randomDelay();
      return Effect.gen(function* () {
        const dbClient = yield* DbClientEffect;
        const user = yield* dbTryOrDefault('[AppApi]', '查询用户(含角色)', () =>
          dbClient.user.findUnique({
            where: { email },
            include: { role: true },
          }),
          null,
        );
        if (!user || !(yield* Effect.tryPromise({
          try: () => compare(password, user.password),
          catch: () => MsgError.msg('密码比对失败'),
        }))) {
          throw MsgError.msg('用户不存在或账户密码错误');
        }
        const userSession = yield* genUserSession(user.id);
        const ctx = yield* ReqCtxService;
        ctx.log('[AppApi] user login', user.id);
        // 手动排除 password 字段并构建返回对象
        const { password: _password, ...userWithoutPassword } = user;
        return Object.assign({}, userSession, { user: userWithoutPassword });
      });
    },
  },
  githubApi,
  fileApi,
  shareApi,
  treeholeApi,
  /** 用于避免 Effect.isEffect 的判断之后得到 Effect<unknown, unknown, unknown> 导致类型系统失效*/
  __effect__() {
    return Effect.succeed('test');
  },
};
export type AppAPI = typeof appApis;
