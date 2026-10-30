import { Effect } from 'effect';
import { randomInt } from 'node:crypto';
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

/** 通道标识（与 PasscodeChannel 枚举值对应的字符串字面量类型） */
export type PasscodeChannelKey = 'WECHAT_OFFICIAL';

/** 用途标识 */
export type PasscodePurposeKey = 'LOGIN';

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
              channel,
              purpose,
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
   */
  verify(
    channel: PasscodeChannelKey,
    code: string,
    channelIdentity: string,
  ): Effect.Effect<boolean, Error, AppConfigService> {
    return Effect.gen(function* () {
      const db = yield* DbClientEffect;
      const now = new Date();
      const result = yield* tryOrFail(`${LOG_PREFIX} 验证口令`, () =>
        db.verificationPasscode.updateMany({
          where: { channel, code, status: 'PENDING', expiresAt: { gt: now } },
          data: { status: 'VERIFIED', channelIdentity, verifiedAt: now },
        }),
      );
      return result.count === 1;
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
