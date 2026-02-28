import { UserData as UserDataModel } from '../../../.zenstack/models';
import { Effect } from 'effect';
import { DbService } from '../../Context/DbService';

export const shareApi = {
  detail(id: UserDataModel['id']) {
    return Effect.gen(function* () {
      const { dbClient } = yield* DbService;
      const row = yield* Effect.promise(() =>
        dbClient.userData.findUnique({
          where: {
            id,
            appId: 'shareInfo',
          },
        }),
      );

      return row;
    });
  },
};
