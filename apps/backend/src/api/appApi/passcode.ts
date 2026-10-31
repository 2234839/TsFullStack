import { Effect, Option } from 'effect';
import { DbClientEffect } from '../../Context/DbService';
import { AppConfigService } from '../../Context/AppConfig';
import { ReqCtxService } from '../../Context/ReqCtx';
import { AuthContext } from '../../Context/Auth';
import { fail, tryOrFail, requireOrFail } from '../../util/error';
import { PasscodeService } from '../../services/PasscodeService';
import { officialName, officialQrUrl } from '../../services/GroupEntryService';
import { genUserSession } from './_genUserSession';
import { generateSecureRandomPassword, generateFakeEmail } from './_oauthUtil';
import { hashPassword } from '../../util/crypto';
import { OauthProvider } from '../../../.zenstack/models';
import type { JsonValue } from '@zenstackhq/orm';
import type { User, Role, UserSession } from '../../../.zenstack/models';
import { randomBytes } from 'node:crypto';
import { KVStore } from '../../Context/KVStore';

/** 匿名创建口令的 IP 限流：10 分钟固定窗口内最多 20 次，防无成本批量生成口令打满 DB（走 KVStore） */
const PASSCODE_CREATE_IP_LIMIT = 20;
const PASSCODE_CREATE_WINDOW_MS = 10 * 60 * 1000;

/** 匿名创建限流：超限抛错（fail 快速返回，不生成口令） */
function passcodeCreateRateLimit(ip: string): Effect.Effect<void, Error, KVStore> {
  return Effect.gen(function* () {
    const kv = yield* KVStore;
    const count = yield* kv.incr(`passcode:create:${ip}`, PASSCODE_CREATE_WINDOW_MS);
    if (count > PASSCODE_CREATE_IP_LIMIT) {
      return yield* fail('创建过于频繁，请稍后再试');
    }
  });
}

/** 日志前缀 */
const LOG_PREFIX = '[PasscodeApi]';

/** ===== 合并验证票据（防账号接管） ===== */

/** 票据有效期（分钟）：验证通过后留给用户确认合并的时间 */
const MERGE_TICKET_TTL_MS = 10 * 60 * 1000;

/** 渠道身份（票据内携带） */
export interface MergeTicketIdentity {
  provider: 'GITHUB' | 'LINUXDO' | 'WECHAT';
  providerId: string;
}

/**
 * 一次性票据：ticket → 渠道身份，存储走 KVStore（TTL 过期与容量淘汰由实现负责）。
 * 安全模型：渠道身份验证（OAuth merge 回调 / 微信 MERGE_VERIFY）成功后由服务端登记，
 * 前端只拿到不透明 ticket，合并时凭 ticket 原子消费（get + compare-and-delete，并发只有一个成功）。
 * 防止攻击者不经渠道验证、直接用可枚举的 providerId（GitHub/LINUX DO 数字 ID）调合并接口接管他人账号。
 */

/** 渠道验证通过后登记一次性合并票据，返回不透明 ticket 给前端 */
export function registerMergeTicket(
  provider: MergeTicketIdentity['provider'],
  providerId: string,
): Effect.Effect<string, never, KVStore> {
  return Effect.gen(function* () {
    const kv = yield* KVStore;
    const ticket = randomBytes(32).toString('base64url');
    yield* kv.set(`merge:ticket:${ticket}`, JSON.stringify({ provider, providerId }), MERGE_TICKET_TTL_MS);
    return ticket;
  });
}

/** 原子消费合并票据：一次性，未过期才返回渠道身份（鉴权侧 accountApi.mergeByMergeTicket 调用） */
export function consumeMergeTicket(ticket: string): Effect.Effect<MergeTicketIdentity | null, never, KVStore> {
  return Effect.gen(function* () {
    const kv = yield* KVStore;
    const key = `merge:ticket:${ticket}`;
    const raw = yield* kv.get(key);
    if (!raw) return null;
    const consumed = yield* kv.takeIfEqual(key, raw);
    if (!consumed) return null;
    return JSON.parse(raw) as MergeTicketIdentity;
  });
}

/** 防口令/密码验证爆破：随机延迟毫秒数 */
const VERIFY_DELAY_MS = 500;

/** 防爆破随机延迟 */
function randomDelay() {
  return Effect.promise(() => new Promise((r) => setTimeout(r, VERIFY_DELAY_MS + Math.random() * VERIFY_DELAY_MS)));
}

/** 轮询状态结果（未完成验证时） */
export interface PasscodePendingView {
  status: 'PENDING' | 'EXPIRED';
  /** 过期时间（前端倒计时用） */
  expiresAt: Date;
}

/** 登录成功结果（与 loginByEmailPwd 返回同形） */
export interface PasscodeLoginView extends UserSession {
  user: Omit<User & { role: Role[] }, 'password'>;
}

/** 创建口令时附带的公众号引导信息 */
export interface PasscodeOfficialView {
  /** 公众号名称 */
  name: string;
  /** 公众号二维码地址（后台上传优先，回退 config） */
  qrUrl: string | null;
}

/**
 * 口令 API —— 通道无关的验证底座对外接口（无需登录态）。
 * 安全模型：ticket 是 secret，仅发起方持有；code 一次性、5 分钟过期、通道内唯一。
 */
export const passcodeApi = {
  /**
   * 发起微信口令登录：生成 6 位口令 + 轮询票据，附带公众号引导信息。
   * 未配置 wechat 时报错（前端据此隐藏入口）。
   */
  createWechatLogin(): Effect.Effect<
    { code: string; ticket: string; expiresAt: Date; official: PasscodeOfficialView },
    Error,
    AppConfigService | KVStore | ReqCtxService
  > {
    return Effect.gen(function* () {
      const appConfig = yield* AppConfigService;
      if (!appConfig.wechat) {
        return yield* fail('微信公众号未配置，口令登录不可用');
      }
      const reqCtx = yield* ReqCtxService;
      yield* passcodeCreateRateLimit(reqCtx.req.ip || 'unknown');
      const record = yield* PasscodeService.create('WECHAT_OFFICIAL', 'LOGIN', { fromIp: reqCtx.req.ip });

      /** 公众号引导：任一空间后台上传过公众号码即用其路由，否则回退 config 的外部 URL */
      const db = yield* DbClientEffect;
      const space = yield* tryOrFail(`${LOG_PREFIX} 查询公众号引导`, () =>
        db.groupSpace.findFirst({
          where: { officialQrImagePath: { not: null } },
          orderBy: { sortOrder: 'asc' },
        }),
      );
      const official: PasscodeOfficialView = {
        name: officialName(space, appConfig.groupEntry),
        qrUrl: officialQrUrl(space, appConfig.groupEntry),
      };

      reqCtx.log(`${LOG_PREFIX} 发起微信口令登录 id=${record.id}`);
      return { code: record.code, ticket: record.ticket, expiresAt: record.expiresAt, official };
    });
  },

  /**
   * 轮询验证状态：VERIFIED 时原子消费并完成登录（绑定/创建用户 + 发 session）。
   * 返回值二态：pending（未完成）或 login（登录成功，与 loginByEmailPwd 同形）。
   */
  checkWechatLogin(
    ticket: string,
  ): Effect.Effect<
    PasscodePendingView | { status: 'LOGIN'; login: PasscodeLoginView },
    Error,
    AppConfigService | ReqCtxService
  > {
    return Effect.gen(function* () {
      const record = yield* PasscodeService.findByTicket(ticket);
      if (!record) return yield* fail('口令不存在或已失效');

      if (record.status !== 'CONSUMED' && record.expiresAt.getTime() < Date.now()) {
        return { status: 'EXPIRED', expiresAt: record.expiresAt };
      }
      if (record.status === 'PENDING') {
        return { status: 'PENDING', expiresAt: record.expiresAt };
      }
      if (record.status === 'CONSUMED') {
        /** 已被并发请求消费：本票据的登录结果只能拿一次，后到者视为失效 */
        return yield* fail('口令已使用，请重新发起');
      }

      /** VERIFIED：原子消费，消费成功者独享登录结果 */
      const consumed = yield* PasscodeService.consume(ticket);
      if (!consumed || !consumed.channelIdentity) {
        return yield* fail('口令已被使用，请重新发起');
      }
      const openid = consumed.channelIdentity;

      const db = yield* DbClientEffect;
      let user = yield* tryOrFail(`${LOG_PREFIX} 查询微信绑定用户`, () =>
        db.user.findFirst({
          where: {
            oAuthAccount: { some: { provider: OauthProvider.WECHAT, providerId: openid } },
          },
          include: { role: true },
        }),
      );

      if (!user) {
        /** 首次微信登录：创建账号并绑定（与 GitHub OAuth 同款流程） */
        const hashedPassword = yield* hashPassword(generateSecureRandomPassword());
        user = yield* tryOrFail(`${LOG_PREFIX} 创建微信用户`, () =>
          db.user.create({
            data: {
              email: generateFakeEmail(),
              password: hashedPassword,
              oAuthAccount: {
                create: {
                  provider: OauthProvider.WECHAT,
                  providerId: openid,
                  profile: { channel: 'WECHAT_OFFICIAL' } as unknown as JsonValue,
                },
              },
            },
            include: { role: true },
          }),
        );
      }
      user = yield* requireOrFail(user, '用户创建失败');

      const session = yield* genUserSession(user.id);
      const reqCtx = yield* ReqCtxService;
      reqCtx.log(`${LOG_PREFIX} 微信口令登录成功 userId=${user.id}`);

      const { password: _pwd, ...userWithoutPassword } = user;
      return { status: 'LOGIN', login: { ...session, user: userWithoutPassword } };
    });
  },

  /**
   * 轮询微信绑定结果：VERIFIED 时原子消费并把 openid 挂到发起账号（payload.userId）。
   * 该微信已绑定任何账号时报错。
   */
  checkWechatBind(
    ticket: string,
  ): Effect.Effect<PasscodePendingView | { status: 'BOUND' }, Error, AppConfigService | ReqCtxService> {
    return Effect.gen(function* () {
      const record = yield* PasscodeService.findByTicket(ticket);
      if (!record) return yield* fail('口令不存在或已失效');
      if (record.purpose !== 'BIND') return yield* fail('口令用途不匹配');

      if (record.status !== 'CONSUMED' && record.expiresAt.getTime() < Date.now()) {
        return { status: 'EXPIRED', expiresAt: record.expiresAt };
      }
      if (record.status === 'PENDING') {
        return { status: 'PENDING', expiresAt: record.expiresAt };
      }
      if (record.status === 'CONSUMED') {
        return yield* fail('口令已使用，请重新发起');
      }

      /** VERIFIED：原子消费，消费成功者独享结果 */
      const consumed = yield* PasscodeService.consume(ticket);
      if (!consumed || !consumed.channelIdentity) {
        return yield* fail('口令已被使用，请重新发起');
      }
      const openid = consumed.channelIdentity;
      /** 发起绑定的账号（以口令 payload 为准，而非当前会话） */
      const payload = (consumed.payload ?? {}) as { userId?: string };
      /** 发起绑定的账号（以口令 payload 为准，而非当前会话） */
      const bindUserId = payload.userId;
      if (!bindUserId) return yield* fail('口令数据异常，请重新发起');

      const db = yield* DbClientEffect;
      const owner = yield* tryOrFail(`${LOG_PREFIX} 查询微信归属`, () =>
        db.oAuthAccount.findFirst({ where: { provider: OauthProvider.WECHAT, providerId: openid } }),
      );
      if (owner) {
        return yield* fail(
          owner.userId === bindUserId ? '该微信已绑定当前账号' : '该微信已绑定其他账号，请先在对方账号解绑',
        );
      }

      yield* tryOrFail(`${LOG_PREFIX} 绑定微信`, () =>
        db.oAuthAccount.create({
          data: {
            userId: bindUserId,
            provider: OauthProvider.WECHAT,
            providerId: openid,
            profile: { channel: 'WECHAT_OFFICIAL' } as unknown as JsonValue,
          },
        }),
      );

      const reqCtx = yield* ReqCtxService;
      reqCtx.log(`${LOG_PREFIX} 微信绑定成功 userId=${bindUserId}`);
      return { status: 'BOUND' };
    });
  },

  /**
   * 发起微信合并验证：purpose=MERGE_VERIFY，回调验证通过后返回 openid 归属供前端发起合并。
   */
  createWechatMergeVerify(): Effect.Effect<
    { code: string; ticket: string; expiresAt: Date; official: PasscodeOfficialView },
    Error,
    AppConfigService | KVStore | ReqCtxService
  > {
    return Effect.gen(function* () {
      const appConfig = yield* AppConfigService;
      if (!appConfig.wechat) {
        return yield* fail('微信公众号未配置，合并验证不可用');
      }
      const reqCtx = yield* ReqCtxService;
      yield* passcodeCreateRateLimit(reqCtx.req.ip || 'unknown');
      const record = yield* PasscodeService.create('WECHAT_OFFICIAL', 'MERGE_VERIFY');

      const db = yield* DbClientEffect;
      const space = yield* tryOrFail(`${LOG_PREFIX} 查询公众号引导`, () =>
        db.groupSpace.findFirst({
          where: { officialQrImagePath: { not: null } },
          orderBy: { sortOrder: 'asc' },
        }),
      );
      const official: PasscodeOfficialView = {
        name: officialName(space, appConfig.groupEntry),
        qrUrl: officialQrUrl(space, appConfig.groupEntry),
      };

      reqCtx.log(`${LOG_PREFIX} 发起微信合并验证 id=${record.id}`);
      return { code: record.code, ticket: record.ticket, expiresAt: record.expiresAt, official };
    });
  },

  /**
   * 轮询微信合并验证结果：VERIFIED 时原子消费，返回一次性合并票据。
   * 前端不得直接拿 providerId 调合并（防接管），只能凭 ticket 调 mergeByMergeTicket。
   */
  checkWechatMergeVerify(
    ticket: string,
  ): Effect.Effect<
    PasscodePendingView | { status: 'VERIFIED'; mergeTicket: string },
    Error,
    AppConfigService | KVStore | ReqCtxService
  > {
    return Effect.gen(function* () {
      const record = yield* PasscodeService.findByTicket(ticket);
      if (!record) return yield* fail('口令不存在或已失效');
      if (record.purpose !== 'MERGE_VERIFY') return yield* fail('口令用途不匹配');

      if (record.status !== 'CONSUMED' && record.expiresAt.getTime() < Date.now()) {
        return { status: 'EXPIRED', expiresAt: record.expiresAt };
      }
      if (record.status === 'PENDING') {
        return { status: 'PENDING', expiresAt: record.expiresAt };
      }
      if (record.status === 'CONSUMED') {
        return yield* fail('口令已使用，请重新发起');
      }

      const consumed = yield* PasscodeService.consume(ticket);
      if (!consumed || !consumed.channelIdentity) {
        return yield* fail('口令已被使用，请重新发起');
      }
      const openid = consumed.channelIdentity;

      const db = yield* DbClientEffect;
      const owner = yield* tryOrFail(`${LOG_PREFIX} 查询微信归属(merge)`, () =>
        db.oAuthAccount.findFirst({ where: { provider: OauthProvider.WECHAT, providerId: openid } }),
      );
      if (!owner) return yield* fail('该微信未绑定任何账号，无需合并验证');

      const reqCtx = yield* ReqCtxService;
      reqCtx.log(`${LOG_PREFIX} 微信合并验证通过 openid=${openid.slice(0, 8)}***，登记票据`);
      return { status: 'VERIFIED', mergeTicket: yield* registerMergeTicket('WECHAT', openid) };
    });
  },
};
