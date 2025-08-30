import { useIdbStorage, useWxtStorage } from './storageUtil';

export const useInfoFlowConfig = () =>
  useWxtStorage('local:infoFlowConfig', {
    fallback: {
      test: 33,
      autoMarkAsRead: false, // 自动已读开关
    },
    version: 4,
    migrations: {
      3: () => {
        return {
          test: 33,
        };
      },
      4: () => {
        return {
          test: 33,
          autoMarkAsRead: false,
        };
      },
    },
  });

// 存储相关函数
export const useCronConfig = () =>
  useWxtStorage('local:cronService', {
    fallback: {
      extensionClosedAt: null as string | null,
    },
  });

export const useIdbTest = () =>
  useIdbStorage('test:config2', {
    fallback: { a: { b: { c: 6 } } },
  });
