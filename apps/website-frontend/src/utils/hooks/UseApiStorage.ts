import { API } from '@/api';
import { authInfo, authInfo_isLogin } from '@/storage';
import { userDataAppid } from '@/storage/userDataAppid';
import { StorageSerializers, useStorage, useStorageAsync, useThrottleFn } from '@vueuse/core';

const appId = userDataAppid.storage_api;

/** 自定义存储适配器,当用户处于登录状态时使用API存储,否则使用本地存储 */
export function useApiStorage<T>(
  key: string,
  defaultValue: T,
  opts?: {
    storage?: Storage | 'auto';
    throttle?: number;
    serializer?: {
      read: (v: string) => T;
      write: (v: T) => string;
    };
    /** 是否合并默认值,默认为false */
    mergeDefaults?: boolean;
  },
) {
  const storage = opts?.storage ?? 'auto';
  const serializer = opts?.serializer ?? StorageSerializers.object;

  const options = {
    ...opts,
    serializer,
  };

  const isLogin = authInfo_isLogin.value;
  const setItem = useThrottleFn(
    async (key: string, value: string) => {
      const parsed = JSON.parse(value);
      await API.db.userData.upsert({
        where: {
          userId_key_appId: {
            key,
            appId,
            userId: authInfo.value.userId,
          },
        },
        create: {
          key,
          appId,
          userId: authInfo.value.userId,
          data: parsed,
        },
        update: {
          data: parsed,
          version: { increment: 1 },
        },
      });
    },
    opts?.throttle ?? 3500,
    true,
  );
  const apiStorageAsync = {
    async getItem(key: string) {
      const res = await API.db.userData.findFirst({
        where: { key, appId, userId: authInfo.value.userId },
      });
      if (!res) return null;
      const data = await res.data;
      return JSON.stringify(data);
    },

    setItem,

    async removeItem(key: string): Promise<void> {
      await API.db.userData.delete({
        where: {
          userId_key_appId: {
            key,
            appId,
            userId: authInfo.value.userId,
          },
        },
      });
    },
  };

  if (storage === 'auto') {
    return isLogin
      ? useStorageAsync<T>(key, defaultValue, apiStorageAsync, options)
      : useStorage<T>(key, defaultValue, undefined, options);
  }

  if (storage === localStorage || storage === sessionStorage) {
    return useStorage<T>(key, defaultValue, storage, options);
  }

  return useStorageAsync<T>(key, defaultValue, apiStorageAsync, options);
}
