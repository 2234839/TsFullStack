import { Effect } from 'effect';
import { DbClientEffect } from '../../Context/DbService';
import { AppConfigService } from '../../Context/AppConfig';
import { ReqCtxService } from '../../Context/ReqCtx';
import { fail, tryOrFail, requireOrFail } from '../../util/error';
import { PasscodeService } from '../../services/PasscodeService';
import { genUserSession } from './_genUserSession';
import { generateSecureRandomPassword, generateFakeEmail } from './_oauthUtil';
import { hashPassword } from '../../util/crypto';
import { OauthProvider } from '../../../.zenstack/models';
import type { JsonValue } from '@zenstackhq/orm';
import type { User, Role, UserSession } from '../../../.zenstack/models';

/** 日志前缀 */
const LOG_PREFIX = '[PasscodeApi]';

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
    AppConfigService | ReqCtxService
  > {
    return Effect.gen(function* () {
      const appConfig = yield* AppConfigService;
      if (!appConfig.wechat) {
        return yield* fail('微信公众号未配置，口令登录不可用');
      }
      const record = yield* PasscodeService.create('WECHAT_OFFICIAL', 'LOGIN');

      /** 公众号引导：任一空间后台上传过公众号码即用其路由，否则回退 config 的外部 URL */
      const db = yield* DbClientEffect;
      const space = yield* tryOrFail(`${LOG_PREFIX} 查询公众号引导`, () =>
        db.groupSpace.findFirst({
          where: { officialQrImagePath: { not: null } },
          orderBy: { sortOrder: 'asc' },
        }),
      );
      const official: PasscodeOfficialView = {
        name: space?.officialName || appConfig.groupEntry?.officialAccountName || '公众号',
        qrUrl: space ? `/group/official-qr/${space.name}.png` : (appConfig.groupEntry?.officialAccountQrUrl ?? null),
      };

      const reqCtx = yield* ReqCtxService;
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
};
