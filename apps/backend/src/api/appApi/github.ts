import { OauthProvider } from '../../../.zenstack/models';
import { Effect } from 'effect';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../../Context/PrismaService';
import { ReqCtxService } from '../../Context/ReqCtx';
import { GithubAuthService } from '../../OAuth/github';
import { genUserSession } from './_genUserSession';
import type { JsonObject } from '@zenstackhq/orm';
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
      const { prisma } = yield* PrismaService;
      const auth = yield* githubAuth;
      const { user: githubUser } = yield* auth.authenticate(code);

      let user = yield* Effect.promise(() =>
        prisma.user.findFirst({
          where: {
            oAuthAccount: {
              some: {
                provider: OauthProvider.GITHUB,
                providerId: String(githubUser.id),
              },
            },
          },
          include: {
            role: true,
          },
        }),
      );

      if (!user) {
        user = yield* Effect.promise(() => {
          return prisma.user.create({
            data: {
              email: uuidv7(),
              password: uuidv7() + githubUser.email,
              oAuthAccount: {
                create: {
                  provider: OauthProvider.GITHUB,
                  providerId: String(githubUser.id),
                  profile: githubUser as unknown as JsonObject,
                },
              },
            },
            include: {
              role: true,
            },
          });
        });
      }

      // TypeScript 类型收窄：上面已经确保 user 不为 null
      if (!user) {
        throw new Error('User creation failed');
      }

      const userId = user.id;
      const userSession = yield* genUserSession(userId);
      const ctx = yield* ReqCtxService;
      ctx.log('user login by github', userId);
      // 手动排除 password 字段
      const { password: _password, ...userWithoutPassword } = user;
      // 明确构造返回对象，避免使用展开运算符处理 ZenStack 复杂类型
      return {
        id: userSession.id,
        token: userSession.token,
        expiresAt: userSession.expiresAt,
        userId: userSession.userId,
        created: userSession.created,
        updated: userSession.updated,
        user: userWithoutPassword,
      };
    });
  },
};

const githubAuth = Effect.gen(function* () {
  return yield* GithubAuthService;
});
