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

/** 同 IP 登录失败封禁阈值（10 分钟窗口内） */
const IP_FAIL_BAN_THRESHOLD = 50;

/** 固定 dummy 哈希（明文为无意义占位串）：用户不存在时也做一次真实 bcrypt compare，抹平「用户是否存在」的时序差异 */
const DUMMY_PASSWORD_HASH = '$2b$10$cKBhelZvPWbGgu9W0lLLpf.8r8rXRQ86p.1/g2FuK4XpU61UIL5ni.';

/**
 * 每 IP 登录失败计数缓存：防止单账号限速下攻击者换账号名爆破（TTL 10 分钟自动归零）
 * 成功登录不清零（避免攻击者登自己账号洗白计数），阈值放宽以兼容 NAT 共享出口
 */
const ipFailCache = Effect.runSync(
  Cache.make({
    capacity: LOGIN_FAIL_CACHE_CAPACITY,
    timeToLive: '10 minutes',
    lookup: (ip: string) => Ref.make(0),
  }),
);

/** IP 失败计数 +1，超过阈值返回 true（应直接拒绝） */
function ipFailTick(ip: string): Effect.Effect<boolean> {
  return Effect.gen(function* () {
    const ref = yield* Cache.get(ipFailCache, ip);
    const count = yield* Ref.modify(ref, (n) => [n + 1, n + 1] as const);
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
