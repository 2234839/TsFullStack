import { Effect } from 'effect';
import { randomBytes, randomInt } from 'node:crypto';
import { Cache, Ref } from 'effect';
import { DbClientEffect } from '../Context/DbService';
import { AppConfigService } from '../Context/AppConfig';
import { tryOrFail } from '../util/error';
import { MS_PER_MINUTE } from '../util/constants';
import type { VerificationPasscode } from '../../.zenstack/models';

/** 日志前缀 */
const LOG_PREFIX = '[Passcode]';

/** 口令有效期：5 分钟 */
export const PASSCODE_TTL_MS = 5 * MS_PER_MINUTE;

/** 生成 6 位数字口令（密码学随机） */
function genCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** code 唯一冲突时的最大重试次数 */
const CREATE_MAX_RETRY = 5;

/** ===== 验证尝试限速（防 6 位口令爆破） ===== */

/** 验证尝试失败计数缓存：key 为 '全局' 或 '渠道:身份'，TTL 内失败次数超限后短封禁 */
const verifyFailCache = Effect.runSync(
  Cache.make({
    capacity: 10_000,
    timeToLive: '10 minutes',
    lookup: (key: string) => Ref.make(0),
  }),
);

/** 单 key 在 TTL 窗口内允许的验证失败次数（命中真口令不算失败） */
const VERIFY_FAIL_LIMIT = 10;

/** 全局门限：多租户正常用户可能同时验错，全局封禁过严会被单个身份的错误打挂所有人，放宽到 500 */
const VERIFY_GLOBAL_FAIL_LIMIT = 500;

/** 触发限流后的封禁时长 */
const VERIFY_BAN_MS = 5 * 60 * 1000;

/** 封禁标记缓存（命中后直接拒绝，不再查库） */
const verifyBanCache = Effect.runSync(
  Cache.make({
    capacity: 10_000,
    timeToLive: `${Math.floor(VERIFY_BAN_MS / 1000)} seconds`,
    lookup: (key: string) => Ref.make(false),
  }),
);

/** 检查是否被封禁（被封禁时直接拒绝，不消耗 DB 查询） */
function isVerifyBanned(key: string): Effect.Effect<boolean> {
  return Effect.gen(function* () {
    const banned = yield* Cache.get(verifyBanCache, key);
    return yield* Ref.get(banned);
  });
}

/** 记录一次验证失败，超限后置封禁标记（limit 可按 key 粒度覆盖，全局门限更宽） */
function recordVerifyFail(key: string, limit: number = VERIFY_FAIL_LIMIT): Effect.Effect<void> {
  return Effect.gen(function* () {
    const ref = yield* Cache.get(verifyFailCache, key);
    const count = yield* Ref.modify(ref, (n) => [n + 1, n + 1] as const);
    if (count > limit) {
      const ban = yield* Cache.get(verifyBanCache, key);
      yield* Ref.set(ban, true);
    }
  });
}

/** 通道标识（与 PasscodeChannel 枚举值对应的字符串字面量类型） */
export type PasscodeChannelKey = 'WECHAT_OFFICIAL';

/** 用途标识：LOGIN 登录 / BIND 绑定到当前账号 / MERGE_VERIFY 验证被合并账号身份 */
export type PasscodePurposeKey = 'LOGIN' | 'BIND' | 'MERGE_VERIFY';

/**
 * 通用验证口令服务：与通道无关的口令底座。
 * 生命周期：create（PENDING）→ verify（通道回传 code，回填身份，VERIFIED）→ consume（发起方原子消费，CONSUMED）
 * 微信公众号只是第一个通道；将来邮箱/短信只需在对应入口调用 verify。
 */
export const PasscodeService = {
  /**
   * 创建待验证口令：
   * - 惰性清理同通道过期记录（避免 code 唯一冲突堆积）
   * - code 为 6 位随机数字，冲突时重试
   * 返回完整记录（ticket 由数据库生成，供发起方轮询）
   */
  create(
    channel: PasscodeChannelKey,
    purpose: PasscodePurposeKey,
    /** 发起方上下文（BIND 用途存发起绑定的 userId 等） */
    payload?: NonNullable<VerificationPasscode['payload']>,
  ): Effect.Effect<VerificationPasscode, Error, AppConfigService> {
    return Effect.gen(function* () {
      const db = yield* DbClientEffect;
      const now = new Date();
      yield* tryOrFail(`${LOG_PREFIX} 清理过期口令`, () =>
        db.verificationPasscode.deleteMany({ where: { expiresAt: { lt: now } } }),
      );

      for (let attempt = 0; attempt < CREATE_MAX_RETRY; attempt++) {
        const code = genCode();
        const created = yield* tryOrFail(`${LOG_PREFIX} 创建口令`, () =>
          db.verificationPasscode.create({
            data: {
              code,
              /** 轮询票据用 CSPRNG（cuid2 的熵源是 Math.random，不可作鉴权凭据） */
              ticket: randomBytes(32).toString('base64url'),
              channel,
              purpose,
              payload,
              expiresAt: new Date(now.getTime() + PASSCODE_TTL_MS),
            },
          }),
        );
        return created;
      }
      return yield* Effect.fail(new Error('口令生成冲突，请重试'));
    });
  },

  /**
   * 通道侧回传验证：code 命中且 PENDING 且未过期时，回填身份并标记 VERIFIED。
   * 原子更新（updateMany 带 status 条件）天然防并发重复验证。
   * 限速：全局与单渠道身份双重失败计数，超限封禁 5 分钟，防 6 位口令爆破
   */
  verify(
    channel: PasscodeChannelKey,
    code: string,
    channelIdentity: string,
  ): Effect.Effect<boolean, Error, AppConfigService> {
    return Effect.gen(function* () {
      const globalKey = 'verify:global';
      const identityKey = `verify:${channel}:${channelIdentity}`;
      if (yield* isVerifyBanned(globalKey)) return false;
      if (yield* isVerifyBanned(identityKey)) return false;

      const db = yield* DbClientEffect;
      const now = new Date();
      const result = yield* tryOrFail(`${LOG_PREFIX} 验证口令`, () =>
        db.verificationPasscode.updateMany({
          where: { channel, code, status: 'PENDING', expiresAt: { gt: now } },
          data: { status: 'VERIFIED', channelIdentity, verifiedAt: now },
        }),
      );
      if (result.count !== 1) {
        /** 未命中：双 key 记失败，超限即封（全局门限制总尝试速率且门限更宽，单身份门防定向爆破） */
        yield* recordVerifyFail(globalKey, VERIFY_GLOBAL_FAIL_LIMIT);
        yield* recordVerifyFail(identityKey);
        return false;
      }
      return true;
    });
  },

  /**
   * 消费已验证口令：ticket 命中且 VERIFIED 且未过期时原子置为 CONSUMED，返回记录。
   * 并发轮询同一 ticket 时只有一个请求能消费成功（幂等由调用方按 purpose 决定）。
   */
  consume(ticket: string): Effect.Effect<VerificationPasscode | null, Error, AppConfigService> {
    return Effect.gen(function* () {
      const db = yield* DbClientEffect;
      const now = new Date();
      const claimed = yield* tryOrFail(`${LOG_PREFIX} 消费口令`, () =>
        db.verificationPasscode.updateMany({
          where: { ticket, status: 'VERIFIED', expiresAt: { gt: now } },
          data: { status: 'CONSUMED', consumedAt: now },
        }),
      );
      if (claimed.count !== 1) return null;
      return yield* tryOrFail(`${LOG_PREFIX} 查询口令`, () =>
        db.verificationPasscode.findUnique({ where: { ticket } }),
      );
    });
  },

  /** 查询口令状态（轮询用，不消费） */
  findByTicket(ticket: string): Effect.Effect<VerificationPasscode | null, Error, AppConfigService> {
    return Effect.gen(function* () {
      const db = yield* DbClientEffect;
      return yield* tryOrFail(`${LOG_PREFIX} 查询口令`, () =>
        db.verificationPasscode.findUnique({ where: { ticket } }),
      );
    });
  },
};
