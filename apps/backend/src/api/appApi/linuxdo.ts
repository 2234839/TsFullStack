import { OauthProvider } from '../../../.zenstack/models';
import type { JsonValue } from '@zenstackhq/orm';
import { Effect, Option } from 'effect';
import { fail, requireOrFail } from '../../util/error';
import { DbClientEffect } from '../../Context/DbService';
import { ReqCtxService } from '../../Context/ReqCtx';
import { AuthContext } from '../../Context/Auth';
import { dbTry } from '../../util/dbEffect';
import { hashPassword } from '../../util/crypto';
import { LinuxDoAuthService } from '../../OAuth/linuxdo';
import { genUserSession } from './_genUserSession';
import { generateSecureRandomPassword, generateFakeEmail } from './_oauthUtil';

/** 日志前缀 */
const LOG_PREFIX = '[LinuxDoApi]';

/**
 * 读取当前登录用户 ID（无鉴权分支不提供 AuthContext，用 serviceOption 安全读取）
 * null 表示未登录
 */
const currentUserId = () =>
  Effect.map(Effect.serviceOption(AuthContext), (opt) => (Option.isSome(opt) ? opt.value.user.id : null));

/** 通过 LINUX DO 登录 */
export const linuxdoApi = {
  getAuthorizationUrl() {
    return Effect.flatMap(LinuxDoAuthService, (auth) => auth.getAuthorizationUrl());
  },
  /** 发起 LINUX DO 绑定（需登录态）：state 标记绑定意图，回调走绑定分支 */
  getBindAuthorizationUrl() {
    return Effect.gen(function* () {
      const userId = yield* currentUserId();
      if (!userId) return yield* fail('请先登录');
      const auth = yield* LinuxDoAuthService;
      const url = yield* auth.getAuthorizationUrl(true);
      const reqCtx = yield* ReqCtxService;
      reqCtx.log(`${LOG_PREFIX} 发起 LINUX DO 绑定 userId=${userId}`);
      return url;
    });
  },
  authenticate(code: string, state?: string) {
    return Effect.gen(function* () {
      const dbClient = yield* DbClientEffect;
      const reqCtx = yield* ReqCtxService;
      const auth = yield* LinuxDoAuthService;
      const { user: linuxdoUser, bind } = yield* auth.authenticate(code, state);

      /** 绑定意图：把 LINUX DO 身份挂到当前登录账号，不建号不发 session */
      if (bind) {
        const userId = yield* currentUserId();
        if (!userId) return yield* fail('绑定需要先登录');

        const owner = yield* dbTry(LOG_PREFIX, '查询 LINUX DO 归属', () =>
          dbClient.oAuthAccount.findFirst({
            where: { provider: OauthProvider.LINUXDO, providerId: String(linuxdoUser.id) },
          }),
        );
        if (owner) {
          return yield* fail(
            owner.userId === userId ? '该 LINUX DO 已绑定当前账号' : '该 LINUX DO 已绑定其他账号，请先在对方账号解绑',
          );
        }

        yield* dbTry(LOG_PREFIX, '绑定 LINUX DO', () =>
          dbClient.oAuthAccount.create({
            data: {
              userId,
              provider: OauthProvider.LINUXDO,
              providerId: String(linuxdoUser.id),
              profile: linuxdoUser as unknown as JsonValue,
            },
          }),
        );
        reqCtx.log(`${LOG_PREFIX} LINUX DO 绑定成功 userId=${userId}`);
        return { bound: true };
      }

      let user = yield* dbTry(LOG_PREFIX, '查询用户', () =>
        dbClient.user.findFirst({
          where: {
            oAuthAccount: {
              some: {
                provider: OauthProvider.LINUXDO,
                providerId: String(linuxdoUser.id),
              },
            },
          },
          include: { role: true },
        }),
      );

      if (!user) {
        const randomPassword = generateSecureRandomPassword();
        const hashedPassword = yield* hashPassword(randomPassword);

        user = yield* dbTry(LOG_PREFIX, '创建用户', () =>
          dbClient.user.create({
            data: {
              email: generateFakeEmail(),
              password: hashedPassword,
              nickname: linuxdoUser.username,
              avatar: linuxdoUser.avatar_url,
              oAuthAccount: {
                create: {
                  provider: OauthProvider.LINUXDO,
                  providerId: String(linuxdoUser.id),
                  profile: linuxdoUser as unknown as JsonValue,
                },
              },
            },
            include: { role: true },
          }),
        );
      }

      user = yield* requireOrFail(user, '用户创建失败');

      const userId = user.id;
      const userSession = yield* genUserSession(userId);
      reqCtx.log(`${LOG_PREFIX} user login by linuxdo`, userId);

      return {
        id: userSession.id,
        token: userSession.token,
        expiresAt: userSession.expiresAt,
        userId: userSession.userId,
        created: userSession.created,
        updated: userSession.updated,
        user: (() => {
          const { password: _, ...rest } = user;
          return rest;
        })(),
      };
    });
  },
};
