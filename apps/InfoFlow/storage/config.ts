import { useIdbStorage, useWxtStorage } from './storageUtil';

export const useInfoFlowConfig = () =>
  useWxtStorage('local:infoFlowConfig', {
    fallback: {
      test: 33,
    },
    version: 3,
    migrations: {
      3: () => {
        return {
          test: 33,
        };
      },
    },
  });

export const useIdbTest = () =>
  useIdbStorage('test:config', {
    fallback: { a: 3 },
  });
