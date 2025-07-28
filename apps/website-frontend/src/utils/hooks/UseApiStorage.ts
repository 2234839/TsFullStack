import { API } from '@/api';
import { authInfo, authInfo_isLogin } from '@/storage';
import { userDataAppid } from '@/storage/userDataAppid';
import {
  StorageSerializers,
  useDocumentVisibility,
  useIntervalFn,
  useStorage,
  useStorageAsync,
  useThrottleFn,
} from '@vueuse/core';
import { ref, watchEffect } from 'vue';

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
    /** 单位：毫秒，设置后启用轮询远程更新 */
    pollingInterval?: number;
    /** 是否合并默认值,默认为false */
    mergeDefaults?: boolean;
    /** api 存储数据的 appid，默认为 userDataAppid.storage_api 的值 */
    appId?: string;
  },
) {
  const appId = opts?.appId ?? userDataAppid.storage_api;
  const storage = opts?.storage ?? 'auto';
  const serializer = opts?.serializer ?? StorageSerializers.object;
  console.log(1111,appId,key,authInfo_isLogin.value);

  const options = {
    ...opts,
    serializer,
  };

  const isLogin = authInfo_isLogin.value;
  /** 目前由于同步远程数据到本地也会触发一次 setItem，导致不停的触发版本升级，暂时使用一个标志位来避免，但感觉可能还会存在bug */
  const isSyncingFromRemote = ref(false);

  const setItem = useThrottleFn(
    async (key: string, value: string) => {
      if (isSyncingFromRemote.value) {
        isSyncingFromRemote.value = false;
        return;
      }

      const parsed = JSON.parse(value);
      localVersion.value += 1;
      await API.db.userData.upsert({
        where: {
          userId_key_appId: {
            key,
            appId,
            userId: authInfo.value.userId,
          },
          version: {
            // 确保版本号不超过本地版本号
            lte: localVersion.value,
          },
        },
        create: {
          key,
          appId,
          userId: authInfo.value.userId,
          data: parsed,
          version: localVersion.value,
        },
        update: {
          data: parsed,
          version: localVersion.value,
        },
      });
    },
    opts?.throttle ?? 3500,
    true,
  );

  const localVersion = ref<number>(0);

  const apiStorageAsync = {
    async getItem(key: string) {
      const res = await API.db.userData.findFirst({
        where: { key, appId, userId: authInfo.value.userId },
      });
      if (!res) return null;
      localVersion.value = res.version;
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

  function createStorage() {
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
  const state = createStorage();

  async function syncStorage() {
    try {
      const res = await API.db.userData.findFirst({
        where: { key, appId, userId: authInfo.value.userId },
        select: { version: true },
      });

      if (res && res.version > localVersion.value) {
        const fullRes = await API.db.userData.findFirst({
          where: { key, appId, userId: authInfo.value.userId },
          select: { version: true, data: true },
        });
        if (!fullRes) {
          throw new Error('Failed to fetch full data');
        }

        localVersion.value = fullRes.version;
        // 更新本地状态（这段取决于 storage 类型）
        const parsed = serializer.read(JSON.stringify(fullRes.data));
        isSyncingFromRemote.value = true;
        state.value = parsed;
      }
    } catch (err) {
      console.warn(`[useApiStorage] polling error:`, err);
    }
  }
  if (opts?.pollingInterval && isLogin) {
    const { pause, resume, isActive } = useIntervalFn(syncStorage, opts.pollingInterval);

    const visibility = useDocumentVisibility();

    /** 当页面不活跃时停止轮询 */
    watchEffect(() => {
      if (visibility.value === 'visible' && !isActive.value) {
        resume();
        // 当页面切换到可见时立即同步一次
        syncStorage();
      } else if (visibility.value === 'hidden') {
        pause();
      }
    });
  }

  return state;
}
