import { Effect } from 'effect';
import { DbClientEffect } from '../../Context/DbService';
import { KVStore } from '../../Context/KVStore';
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

/** 失败计数窗口（10 分钟固定窗口，首次失败时起算，走 KVStore） */
const LOGIN_FAIL_WINDOW_MS = 10 * 60 * 1000;

/** 同 IP 登录失败封禁阈值（10 分钟窗口内） */
const IP_FAIL_BAN_THRESHOLD = 50;

/** 固定 dummy 哈希（明文为无意义占位串）：用户不存在时也做一次真实 bcrypt compare，抹平「用户是否存在」的时序差异 */
const DUMMY_PASSWORD_HASH = '$2b$10$cKBhelZvPWbGgu9W0lLLpf.8r8rXRQ86p.1/g2FuK4XpU61UIL5ni.';

/**
 * 每 IP 登录失败计数：防止单账号限速下攻击者换账号名爆破（10 分钟窗口自动归零）
 * 成功登录不清零（避免攻击者登自己账号洗白计数），阈值放宽以兼容 NAT 共享出口
 */
function ipFailTick(ip: string): Effect.Effect<boolean, never, KVStore> {
  return Effect.gen(function* () {
    const kv = yield* KVStore;
    const count = yield* kv.incr(`login:fail:ip:${ip}`, LOGIN_FAIL_WINDOW_MS);
    return count > IP_FAIL_BAN_THRESHOLD;
  });
}

/** 取请求来源 IP（无请求上下文时退化为 'unknown'） */
function getReqIp(): Effect.Effect<string, never, ReqCtxService> {
  return Effect.gen(function* () {
    const ctx = yield* ReqCtxService;
    return ctx.req.ip || 'unknown';
  });
}

/** 登录失败递增延迟（毫秒）：该账号失败计数 +1，失败越多等越久，封顶 5 秒（10 分钟窗口自动归零，走 KVStore） */
function loginFailDelay(email: string): Effect.Effect<number, never, KVStore> {
  return Effect.gen(function* () {
    const kv = yield* KVStore;
    const count = yield* kv.incr(`login:fail:${email}`, LOGIN_FAIL_WINDOW_MS);
    return Math.min(count * LOGIN_FAIL_DELAY_STEP_MS, LOGIN_FAIL_DELAY_MAX_MS);
  });
}

/** 登录成功后清除该账号的失败计数 */
function clearLoginFails(email: string) {
  return Effect.gen(function* () {
    const kv = yield* KVStore;
    yield* kv.del(`login:fail:${email}`);
  });
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

      const ip = yield* getReqIp();
      if (yield* ipFailTick(ip)) {
        const ctx = yield* ReqCtxService;
        ctx.log(LOG_PREFIX, 'IP 登录失败超限，拒绝:', ip);
        return yield* fail(MSG.LOGIN_FAILED);
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
      if (user?.passwordLoginDisabled) {
        return yield* fail('该账号用户已禁用密码登录，请使用绑定的第三方渠道登录');
      }
      if (!user || !(yield* comparePassword(password, user.password))) {
        /** 用户不存在时也对 dummy 哈希做一次真实 compare，抹平时序差异 */
        if (!user) {
          yield* comparePassword(password, DUMMY_PASSWORD_HASH);
        }
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
  /**
   * 仅验证邮箱密码凭据，不创建会话。
   * 供登录卡片「验证模式」等敏感操作前的身份确认复用（如账号合并验证目标账号所有权）。
   * 防爆破策略与 loginByEmailPwd 一致：失败递增延迟，成功清零计数。
   */
  verifyByEmailPwd(email: string, password: string) {
    return Effect.gen(function* () {
      yield* validateEmail(email);
      const dbClient = yield* DbClientEffect;

      if (!password || typeof password !== 'string') {
        return yield* fail(MSG.PASSWORD_REQUIRED);
      }

      const ip = yield* getReqIp();
      if (yield* ipFailTick(ip)) {
        const ctx = yield* ReqCtxService;
        ctx.log(LOG_PREFIX, 'IP 登录失败超限，拒绝:', ip);
        return yield* fail(MSG.LOGIN_FAILED);
      }
      const user = yield* dbTryOrDefault(
        LOG_PREFIX,
        '验证凭据查询用户',
        () =>
          dbClient.user.findUnique({
            where: { email },
            include: { role: true },
          }),
        null,
      );
      if (user?.passwordLoginDisabled) {
        return yield* fail('该账号用户已禁用密码登录，密码不再作为有效验证因子');
      }
      if (!user || !(yield* comparePassword(password, user.password))) {
        /** 用户不存在时也对 dummy 哈希做一次真实 compare，抹平时序差异 */
        if (!user) {
          yield* comparePassword(password, DUMMY_PASSWORD_HASH);
        }
        const delayMs = yield* loginFailDelay(email);
        yield* Effect.sleep(`${delayMs / 1000} seconds`).pipe(Effect.withSpan('loginFailDelay(失败递增延迟)'));
        return yield* fail(MSG.LOGIN_FAILED);
      }
      yield* clearLoginFails(email);
      const ctx = yield* ReqCtxService;
      ctx.log(`${LOG_PREFIX} 凭据验证通过 userId=${user.id}`);
      /** 返回脱敏用户信息（使用方校验「验证的目标」是否符合预期，如合并非当前账号） */
      const { password: _password, ...userWithoutPassword } = user;
      return { verified: true as const, user: userWithoutPassword };
    });
  },
};
