import { useIdbStorage, useWxtStorage } from './storageUtil';

export const useInfoFlowConfig = () =>
  useWxtStorage('local:infoFlowConfig', {
    fallback: {
      test: 33,
      autoMarkAsRead: true, // 自动已读开关
      rulesPageSize: 10, // 规则管理页面分页大小
    },
    version: 5,
    migrations: {
      3: () => {
        return {
          test: 33,
        };
      },
      4: () => {
        return {
          test: 33,
          autoMarkAsRead: true,
        };
      },
      5: () => {
        return {
          test: 33,
          autoMarkAsRead: true,
          rulesPageSize: 10,
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
