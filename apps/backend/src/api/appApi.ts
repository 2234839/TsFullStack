import { compareSync } from 'bcryptjs';
import { Effect } from 'effect';
import { getPrisma, prisma } from '../db';
import { ReqCtxService } from '../service/ReqCtx';
import { MsgError } from '../util/error';
import { githubApi } from './app/github';
import { genUserSession } from './app/_genUserSession';

/** 无需鉴权的 api */
export const appApis = {
  system: {
    async register(email: string, password: string) {
      return Effect.gen(function* () {
        throw MsgError.msg('暂时关闭了直接注册帐号，请使用其他方式登录！ ');
        const user = yield* Effect.promise(() =>
          prisma.user.findUnique({
            where: {
              email,
            },
          }),
        );
        if (user) {
          throw MsgError.msg('用户已存在');
        }
        const newUser = yield* Effect.promise(() =>
          prisma.user.create({
            data: {
              email,
              password,
            },
          }),
        );
        const ctx = yield* ReqCtxService;
        ctx.log('register user', newUser.id);
        return newUser;
      });
    },
    async loginByEmailPwd(email: string, password: string) {
      return Effect.gen(function* () {
        const user = yield* Effect.promise(() =>
          prisma.user.findUnique({
            where: {
              email,
            },
          }),
        );
        if (!user || !compareSync(password, user.password)) {
          throw MsgError.msg('用户不存在或账户密码错误');
        }
        const userSession = yield* genUserSession(user.id);
        const ctx = yield* ReqCtxService;
        ctx.log('user login', user.id);
        return userSession;
      });
    },
  },
  githubApi,
  /** 用于避免 Effect.isEffect 的判断之后得到 Effect<unknown, unknown, unknown> 导致类型系统失效*/
  __effect__() {
    return Effect.succeed('test');
  },
};
export type AppAPI = typeof appApis;
