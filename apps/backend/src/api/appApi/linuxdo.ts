import { OauthProvider } from '../../../.zenstack/models';
import type { JsonValue } from '@zenstackhq/orm';
import { Effect } from 'effect';
import { requireOrFail } from '../../util/error';
import { DbClientEffect } from '../../Context/DbService';
import { ReqCtxService } from '../../Context/ReqCtx';
import { dbTry } from '../../util/dbEffect';
import { hashPassword } from '../../util/crypto';
import { LinuxDoAuthService } from '../../OAuth/linuxdo';
import { genUserSession } from './_genUserSession';
import { generateSecureRandomPassword, generateFakeEmail } from './_oauthUtil';

/** 日志前缀 */
const LOG_PREFIX = '[LinuxDoApi]';

/** 通过 LINUX DO 登录 */
export const linuxdoApi = {
  getAuthorizationUrl() {
    return Effect.flatMap(LinuxDoAuthService, (auth) => auth.getAuthorizationUrl());
  },
  authenticate(code: string) {
    return Effect.gen(function* () {
      const dbClient = yield* DbClientEffect;
      const reqCtx = yield* ReqCtxService;
      const auth = yield* LinuxDoAuthService;
      const { user: linuxdoUser } = yield* auth.authenticate(code);

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
