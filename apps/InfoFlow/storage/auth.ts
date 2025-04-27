import { useStorage } from '@/utils/userStorage.hook';

export const { data: authStore, loadingPromise: authStoreLoadingPromise } = useStorage(
  'local:auth_v0',
  () => ({
    token: null as null | string,
    userId: null as null | string,
  }),
);
