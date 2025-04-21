import { routeMap, routerUtil } from '@/router';
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
/** 清楚认证信息并跳转到登录页面  */
export function authInfo_logout() {
  authInfo.value = undefined;
  routerUtil.push(routeMap.login, {});
}

//#region 主题功能
export const theme = useStorage<'dark' | 'light'>('theme', null, undefined, {
  serializer: StorageSerializers.object,
});

/**  src/style.css 中也需要设置和此处一样 */
export const theme_darkModeClass = 'app-dark';
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
    document.documentElement.classList.add(theme_darkModeClass);
  } else {
    document.documentElement.classList.remove(theme_darkModeClass);
  }
});

//#endregion 主题功能
