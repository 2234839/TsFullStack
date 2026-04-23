import { OauthProvider } from '../../../.zenstack/models';
import type { JsonValue } from '@zenstackhq/orm';
import { randomBytes } from 'node:crypto';
import { Effect } from 'effect';
import { fail, neverReturn, MsgError } from '../../util/error';
import { DbClientEffect } from '../../Context/DbService';
import { ReqCtxService } from '../../Context/ReqCtx';
import { dbTry } from '../../util/dbEffect';
import { hashPassword } from '../../util/crypto';
import { GithubAuthService } from '../../OAuth/github';
import { genUserSession } from './_genUserSession';

/** 生成加密安全的随机密码（OAuth 用户不会通过密码登录，仅满足数据库非空约束） */
function generateSecureRandomPassword(): string {
  return randomBytes(32).toString('hex');
}

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
        const randomPassword = generateSecureRandomPassword();
        const hashedPassword = yield* hashPassword(randomPassword);

        user = yield* dbTry('[GithubApi]', '创建用户', () =>
          dbClient.user.create({
            data: {
              email: generateSecureRandomPassword() + '@oauth.local',
              password: hashedPassword,
              oAuthAccount: {
                create: {
                  provider: OauthProvider.GITHUB,
                  providerId: String(githubUser.id),
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  /** GitHubUser → JsonValue: ZenStack profile 字段要求 JsonValue 类型，运行时结构兼容 */
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
        yield* fail('用户创建失败');
        return neverReturn();
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
