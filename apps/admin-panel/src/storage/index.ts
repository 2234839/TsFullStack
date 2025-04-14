import { StorageSerializers, useStorage } from '@vueuse/core';
import { computed } from 'vue';

/** 用户认证信息存储  */
export const authInfo = useStorage<{
  userId: string;
  token: string;
  expiresAt: number;
}>('authInfo', null, undefined, { serializer: StorageSerializers.object });

export const authInfo_isLogin = computed(() => {
  return !!authInfo.value && authInfo.value.expiresAt > Date.now();
});
