import { UserData as UserDataModel } from '@zenstackhq/runtime/models';
import { Effect } from 'effect';
import { prisma } from '../../db';

export const shareApi = {
  detail(id: UserDataModel['id']) {
    return Effect.gen(function* () {
      const row = yield* Effect.promise(() =>
        prisma.userData.findUnique({
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
