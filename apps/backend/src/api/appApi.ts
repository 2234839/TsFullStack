import { Effect } from 'effect';
import { DbClientEffect } from '../Context/DbService';
import { ReqCtxService } from '../Context/ReqCtx';
import { fail, neverReturn } from '../util/error';
import { dbTry, dbTryOrDefault } from '../util/dbEffect';
import { MsgError } from '../util/error';
import { hashPassword, comparePassword } from '../util/crypto';
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

        /** 输入校验：email 格式和 password 长度 */
        if (!email || typeof email !== 'string' || !email.includes('@')) {
          yield* fail('邮箱格式不正确');
          return neverReturn();
        }
        if (!password || typeof password !== 'string' || password.length < 6) {
          yield* fail('密码长度不能少于6位');
          return neverReturn();
        }
        if (password.length > 200) {
          yield* fail('密码长度不能超过200位');
          return neverReturn();
        }

        // throw MsgError.msg('暂时关闭了直接注册帐号，请使用其他方式登录！ '); // 保留注释以便需要时快速恢复注册限制

        const user = yield* dbTryOrDefault('[AppApi]', '查询用户', () =>
          dbClient.user.findUnique({
            where: { email },
          }),
          null,
        );
        if (user) {
          yield* fail('用户已存在');
          return neverReturn();
        }
        /** 对密码进行哈希处理（异步，避免阻塞事件循环） */
        const hashedPassword = yield* hashPassword(password);
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

        /** 输入校验：email 格式和 password 非空 */
        if (!email || typeof email !== 'string' || !email.includes('@')) {
          yield* fail('邮箱格式不正确');
          return neverReturn();
        }
        if (!password || typeof password !== 'string') {
          yield* fail('密码不能为空');
          return neverReturn();
        }

        const user = yield* dbTryOrDefault('[AppApi]', '查询用户(含角色)', () =>
          dbClient.user.findUnique({
            where: { email },
            include: { role: true },
          }),
          null,
        );
        if (!user || !(yield* comparePassword(password, user.password))) {
          yield* fail('用户不存在或账户密码错误');
          return neverReturn();
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
