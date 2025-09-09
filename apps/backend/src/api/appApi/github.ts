import { OauthProvider } from '@prisma/client';
import { Effect } from 'effect';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../../Context/PrismaService';
import { ReqCtxService } from '../../Context/ReqCtx';
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
                  profile: githubUser as any,
                },
              },
            },
            include: {
              role: true,
            },
          });
        });
      }

      const userId = user.id;
      const userSession = yield* genUserSession(userId);
      const ctx = yield* ReqCtxService;
      ctx.log('user login by github', userId);
      const userWithoutPassword = { ...user, password: undefined };
      return { ...userSession, user: userWithoutPassword };
    });
  },
};

const githubAuth = Effect.gen(function* () {
  return yield* GithubAuthService;
});
