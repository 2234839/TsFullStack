import { useStorage } from '@vueuse/core';

/** 用户认证信息存储  */
export const authInfo = useStorage<
  | {
      userId: string;
      token: string;
      expiresAt: number;
    }
  | undefined
>('authInfo', undefined);
