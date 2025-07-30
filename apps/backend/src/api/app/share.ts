import { UserData as UserDataModel } from '@zenstackhq/runtime/models';
import { Effect } from 'effect';
import { PrismaService } from '../../service/PrismaService';

export const shareApi = {
  detail(id: UserDataModel['id']) {
    return Effect.gen(function* () {
      const { prisma } = yield* PrismaService;
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
