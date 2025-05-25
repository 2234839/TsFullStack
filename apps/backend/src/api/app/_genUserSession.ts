import { Effect } from 'effect';
import { getPrisma } from '../../db';
import type { User } from '@prisma/client';

/** 注意，使用此接口时请确保用户传入的 id 是他自身的，也就是不应该让用户直接调用此接口 */
export function genUserSession(userId: User['id']) {
  return Effect.gen(function* () {
    const { db } = yield* Effect.promise(() => getPrisma({ userId }));
    const userSession = yield* Effect.promise(() =>
      db.userSession.create({
        data: {
          userId: userId,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7天后过期
        },
      }),
    );
    return userSession;
  });
}
