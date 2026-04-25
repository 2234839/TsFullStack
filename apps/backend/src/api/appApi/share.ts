import { UserData as UserDataModel } from '../../../.zenstack/models';
import { Effect } from 'effect';
import { DbClientEffect } from '../../Context/DbService';
import { dbTryOrDefault } from '../../util/dbEffect';

const LOG_PREFIX = '[ShareApi]';

export const shareApi = {
  detail(id: UserDataModel['id']) {
    return Effect.gen(function* () {
      const dbClient = yield* DbClientEffect;
      return yield* dbTryOrDefault(LOG_PREFIX, '查询分享信息', () =>
        dbClient.userData.findUnique({
          where: {
            id,
            appId: 'shareInfo',
          },
        }),
        null,
      );
    });
  },
};
