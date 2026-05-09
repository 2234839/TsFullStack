import { Effect } from 'effect';
import { getDbAuthEffect } from '../../Context/DbService';
import { dbTry } from '../../util/dbEffect';
import type { User } from '../../../.zenstack/models';
import { SESSION_EXPIRY_MS } from '../../util/constants';

/** 日志前缀 */
const LOG_PREFIX = '[UserSession]';

/** 注意，使用此接口时请确保用户传入的 id 是他自身的，也就是不应该让用户直接调用此接口 */
export function genUserSession(userId: User['id']) {
  return Effect.flatMap(
    getDbAuthEffect({ userId }),
    ({ db }) => dbTry(LOG_PREFIX, '创建用户会话', () =>
      db.userSession.create({
        data: {
          userId: userId,
          expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
        },
      }),
    ),
  );
}
