import { OauthProvider } from '../../../.zenstack/models';
import type { JsonValue } from '@zenstackhq/orm';
import { Effect } from 'effect';
import { v7 as uuidv7 } from 'uuid';
import { hash } from 'bcryptjs';
import { DbClientEffect } from '../../Context/DbService';
import { ReqCtxService } from '../../Context/ReqCtx';
import { dbTry } from '../../util/dbEffect';
import { MsgError } from '../../util/error';
import { GithubAuthService } from '../../OAuth/github';
import { genUserSession } from './_genUserSession';

/** 通过 Github 登录 */
export const githubApi = {
  getAuthorizationUrl() {
    return Effect.gen(function* () {
      const auth = yield* githubAuth;
      return yield* auth.getAuthorizationUrl();
    });
  },
  authenticate(code: string) {
    return Effect.gen(function* () {
      const dbClient = yield* DbClientEffect;
      const reqCtx = yield* ReqCtxService;
      const auth = yield* githubAuth;
      const { user: githubUser } = yield* auth.authenticate(code);

      let user = yield* dbTry('[GithubApi]', '查询用户', () =>
        dbClient.user.findFirst({
          where: {
            oAuthAccount: {
              some: {
                provider: OauthProvider.GITHUB,
                providerId: String(githubUser.id),
              },
            },
          },
          include: { role: true },
        }),
      );

      if (!user) {
        /** 为 OAuth 用户生成随机密码并哈希处理（用户不会通过密码登录，但需要满足数据库约束） */
        const randomPassword = uuidv7() + githubUser.email;
        const hashedPassword = yield* Effect.tryPromise({
          try: () => hash(randomPassword, 10),
          catch: () => MsgError.msg('密码哈希处理失败'),
        });

        user = yield* dbTry('[GithubApi]', '创建用户', () =>
          dbClient.user.create({
            data: {
              email: uuidv7(),
              password: hashedPassword,
              oAuthAccount: {
                create: {
                  provider: OauthProvider.GITHUB,
                  providerId: String(githubUser.id),
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  profile: githubUser as unknown as JsonValue,
                },
              },
            },
            include: { role: true },
          }),
        );
      }

      // TypeScript 类型收窄：上面已经确保 user 不为 null
      if (!user) {
        throw MsgError.msg('用户创建失败');
      }

      const userId = user.id;
      const userSession = yield* genUserSession(userId);
      reqCtx.log('[GithubApi] user login by github', userId);

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

const githubAuth = Effect.gen(function* () {
  return yield* GithubAuthService;
});
