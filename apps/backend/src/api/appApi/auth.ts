import { Cache, Effect, Ref } from 'effect';
import { DbClientEffect } from '../../Context/DbService';
import { ReqCtxService } from '../../Context/ReqCtx';
import { fail } from '../../util/error';
import { dbTry, dbTryOrDefault } from '../../util/dbEffect';
import { comparePassword, hashPassword } from '../../util/crypto';
import { MSG } from '../../util/constants';
import { genUserSession } from './_genUserSession';

/** 日志前缀 */
const LOG_PREFIX = '[AppApi:auth]';

/** 登录失败延迟步长（毫秒），每次连续失败递增一档 */
const LOGIN_FAIL_DELAY_STEP_MS = 300;
/** 登录失败延迟上限（毫秒） */
const LOGIN_FAIL_DELAY_MAX_MS = 5_000;
/** 失败记录表容量上限，超出由 Cache 按 TTL/容量自动淘汰，防止账号无限累积 */
const LOGIN_FAIL_CACHE_CAPACITY = 10_000;

/**
 * 每账号登录失败计数缓存：TTL 内连续失败递增，过期自动归零，容量超限自动淘汰
 */
const loginFailCache = Effect.runSync(
  Cache.make({
    capacity: LOGIN_FAIL_CACHE_CAPACITY,
    timeToLive: '10 minutes',
    lookup: (email: string) => Ref.make(0),
  }),
);

/** 登录失败递增延迟（毫秒）：取该账号失败计数并 +1，失败越多等越久，封顶 5 秒 */
function loginFailDelay(email: string): Effect.Effect<number> {
  return Effect.gen(function* () {
    const ref = yield* Cache.get(loginFailCache, email);
    const count = yield* Ref.modify(ref, (n) => [n + 1, n + 1] as const);
    return Math.min(count * LOGIN_FAIL_DELAY_STEP_MS, LOGIN_FAIL_DELAY_MAX_MS);
  });
}

/** 登录成功后清除该账号的失败计数 */
function clearLoginFails(email: string) {
  return Cache.invalidate(loginFailCache, email);
}

/** 密码最小长度 */
const MIN_PASSWORD_LENGTH = 6;
/** 密码最大长度 */
const MAX_PASSWORD_LENGTH = 200;

/** 基本邮箱格式校验 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validateEmail = (email: string) =>
  !email || typeof email !== 'string' || !EMAIL_REGEX.test(email) ? fail(MSG.EMAIL_FORMAT_INVALID) : Effect.void;

/** 账号密码注册与登录 */
export const authApi = {
  register(email: string, password: string) {
    return Effect.gen(function* () {
      yield* validateEmail(email);
      const dbClient = yield* DbClientEffect;

      if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        return yield* fail(MSG.PASSWORD_TOO_SHORT);
      }
      if (password.length > MAX_PASSWORD_LENGTH) {
        return yield* fail(MSG.PASSWORD_TOO_LONG);
      }

      const user = yield* dbTryOrDefault(
        LOG_PREFIX,
        '查询用户',
        () =>
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
      yield* validateEmail(email);
      const dbClient = yield* DbClientEffect;

      if (!password || typeof password !== 'string') {
        return yield* fail(MSG.PASSWORD_REQUIRED);
      }

      const user = yield* dbTryOrDefault(
        LOG_PREFIX,
        '查询用户(含角色)',
        () =>
          dbClient.user.findUnique({
            where: { email },
            include: { role: true },
          }),
        null,
      );
      if (!user || !(yield* comparePassword(password, user.password))) {
        /** 仅对失败账号递增延迟，正常用户零等待 */
        const delayMs = yield* loginFailDelay(email);
        yield* Effect.sleep(`${delayMs / 1000} seconds`).pipe(Effect.withSpan('loginFailDelay(失败递增延迟)'));
        return yield* fail(MSG.LOGIN_FAILED);
      }
      yield* clearLoginFails(email);
      const userSession = yield* genUserSession(user.id);
      const ctx = yield* ReqCtxService;
      ctx.log(LOG_PREFIX, 'user login', user.id);
      const { password: _password, ...userWithoutPassword } = user;
      return { ...userSession, user: userWithoutPassword };
    });
  },
};
