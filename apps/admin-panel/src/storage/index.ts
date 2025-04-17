import { StorageSerializers, useStorage } from '@vueuse/core';
import { computed, watchEffect } from 'vue';

/** 用户认证信息存储  */
export const authInfo = useStorage<
  | {
      userId: string;
      token: string;
      expiresAt: number;
    }
  | undefined
>('authInfo', null, undefined, { serializer: StorageSerializers.object });

export const authInfo_isLogin = computed(() => {
  return !!authInfo.value && authInfo.value.expiresAt > Date.now();
});

//#region 主题功能
export const theme = useStorage<'dark' | 'light'>('theme', null, undefined, {
  serializer: StorageSerializers.object,
});
export const theme_darkModeClass = 'my-app-dark';
export const theme_isDark = computed<boolean>({
  set(v) {
    theme.value = v ? 'dark' : 'light';
  },
  get() {
    return theme.value === 'dark';
  },
});
watchEffect(() => {
  if (theme_isDark.value) {
    document.documentElement.classList.add('my-app-dark');
  } else {
    document.documentElement.classList.remove('my-app-dark');
  }
});

//#endregion 主题功能
