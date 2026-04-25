import { Effect } from 'effect';
import { DbClientEffect } from '../Context/DbService';
import { ReqCtxService } from '../Context/ReqCtx';
import { fail } from '../util/error';
import { dbTry, dbTryOrDefault } from '../util/dbEffect';
import { hashPassword, comparePassword } from '../util/crypto';
import { MSG } from '../util/constants';
import { genUserSession } from './appApi/_genUserSession';
import { fileApi } from './appApi/file';
import { githubApi } from './appApi/github';
import { shareApi } from './appApi/share';
import { treeholeApi } from './appApi/treehole';

/** 日志前缀 */
const LOG_PREFIX = '[AppApi]';

/** 防暴力破解最小延迟（毫秒） */
const AUTH_DELAY_BASE_MS = 500;
/** 防暴力破解随机延迟上限（毫秒） */
const AUTH_DELAY_RANDOM_MS = 2_000;
/** 密码最小长度 */
const MIN_PASSWORD_LENGTH = 6;
/** 密码最大长度 */
const MAX_PASSWORD_LENGTH = 200;

/** 防暴力破解随机延迟 */
function randomDelay(baseDelay = AUTH_DELAY_BASE_MS) {
  return Effect.sleep(`${(baseDelay + AUTH_DELAY_RANDOM_MS * Math.random()) / 1000} seconds`);
}

/** 邮箱格式校验 */
const validateEmail = (email: string) =>
  (!email || typeof email !== 'string' || !email.includes('@'))
    ? fail(MSG.EMAIL_FORMAT_INVALID)
    : Effect.void;

/** 无需鉴权的 api */
export const appApis = {
  system: {
    register(email: string, password: string) {
      return Effect.gen(function* () {
        yield* randomDelay();
        yield* validateEmail(email);
        const dbClient = yield* DbClientEffect;

        if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
          return yield* fail(MSG.PASSWORD_TOO_SHORT);
        }
        if (password.length > MAX_PASSWORD_LENGTH) {
          return yield* fail(MSG.PASSWORD_TOO_LONG);
        }

        const user = yield* dbTryOrDefault(LOG_PREFIX, '查询用户', () =>
          dbClient.user.findUnique({
            where: { email },
          }),
          null,
        );
        if (user) {
          return yield* fail(MSG.USER_ALREADY_EXISTS);
        }
        /** 对密码进行哈希处理（异步，避免阻塞事件循环） */
        const hashedPassword = yield* hashPassword(password);
        const newUser = yield* dbTry(LOG_PREFIX, '创建用户', () =>
          dbClient.user.create({
            data: { email, password: hashedPassword },
          }),
        );
        const ctx = yield* ReqCtxService;
        ctx.log(LOG_PREFIX, 'register user', newUser.id);
        return newUser;
      });
    },
    loginByEmailPwd(email: string, password: string) {
      return Effect.gen(function* () {
        yield* randomDelay();
        yield* validateEmail(email);
        const dbClient = yield* DbClientEffect;

        if (!password || typeof password !== 'string') {
          return yield* fail(MSG.PASSWORD_REQUIRED);
        }

        const user = yield* dbTryOrDefault(LOG_PREFIX, '查询用户(含角色)', () =>
          dbClient.user.findUnique({
            where: { email },
            include: { role: true },
          }),
          null,
        );
        if (!user || !(yield* comparePassword(password, user.password))) {
          return yield* fail(MSG.LOGIN_FAILED);
        }
        const userSession = yield* genUserSession(user.id);
        const ctx = yield* ReqCtxService;
        ctx.log(LOG_PREFIX, 'user login', user.id);
        const { password: _password, ...userWithoutPassword } = user;
        return { ...userSession, user: userWithoutPassword };
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
