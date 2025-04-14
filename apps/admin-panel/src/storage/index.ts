import { useStorage } from '@vueuse/core';

/** 用户认证信息存储  */
export const authInfo = useStorage('authInfo', undefined);
