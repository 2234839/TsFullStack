import { compareSync } from 'bcryptjs';
import { Effect } from 'effect';
import { getPrisma, prisma } from '../db';

/** 无需鉴权的 api */
export const appApis = {
  system: {
    async register(email: string, password: string) {
      const user = await prisma.user.findUnique({
        where: {
          email,
        },
      });
      if (user) {
        return Effect.fail('用户已存在');
      }
      const newUser = await prisma.user.create({
        data: {
          email,
          password,
        },
      });
      return newUser;
    },
    async loginByEmailPwd(email: string, password: string) {
      const user = await prisma.user.findUnique({
        where: {
          email,
        },
      });
      // https://zenstack.dev/blog/rest-api-on-vercel#5-adding-authentication
      if (!user || !compareSync(password, user.password)) {
        return Effect.fail('用户不存在或账户密码错误');
      }
      const { db } = await getPrisma({ userId: user.id });
      const userSession = await db.userSession.create({
        data: {
          userId: user.id,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7天后过期
        },
      });
      return userSession;
    },
  },
  /** 用于避免 Effect.isEffect 的判断之后得到 Effect<unknown, unknown, unknown> 导致类型系统失效*/
  __effect__() {
    return Effect.succeed('test');
  },
};
export type AppAPI = typeof appApis;
