import { OauthProvider } from '../../../.zenstack/models';
import type { JsonValue } from '@zenstackhq/orm';
import { randomBytes } from 'node:crypto';
import { Effect } from 'effect';
import { requireOrFail } from '../../util/error';
import { DbClientEffect } from '../../Context/DbService';
import { ReqCtxService } from '../../Context/ReqCtx';
import { dbTry } from '../../util/dbEffect';
import { hashPassword } from '../../util/crypto';
import { GithubAuthService } from '../../OAuth/github';
import { genUserSession } from './_genUserSession';

/** 日志前缀 */
const LOG_PREFIX = '[GithubApi]';

/** OAuth 随机密码字节数 */
const OAUTH_PASSWORD_BYTES = 32;

/** OAuth 伪邮箱随机字节数 */
const OAUTH_EMAIL_RANDOM_BYTES = 16;

/** 生成加密安全的随机密码（OAuth 用户不会通过密码登录，仅满足数据库非空约束） */
function generateSecureRandomPassword(): string {
  return randomBytes(OAUTH_PASSWORD_BYTES).toString('hex');
}

/** 生成伪随机邮箱（OAuth 用户不使用邮箱登录，仅满足数据库唯一约束） */
function generateFakeEmail(): string {
  return `${randomBytes(OAUTH_EMAIL_RANDOM_BYTES).toString('hex')}@oauth.local`;
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

      let user = yield* dbTry(LOG_PREFIX, '查询用户', () =>
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

        user = yield* dbTry(LOG_PREFIX, '创建用户', () =>
          dbClient.user.create({
            data: {
              email: generateFakeEmail(),
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

      /** TypeScript 类型收窄：上面已经确保 user 不为 null */
      user = yield* requireOrFail(user, '用户创建失败');

      const userId = user.id;
      const userSession = yield* genUserSession(userId);
      reqCtx.log(`${LOG_PREFIX} user login by github`, userId);

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

const githubAuth = GithubAuthService;
