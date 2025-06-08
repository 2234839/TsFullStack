import { routeMap, routerUtil } from '@/router';
import { encryptSerializer } from '@/utils/encryptSerializer';
import { StorageSerializers, useStorage, useStorageAsync } from '@vueuse/core';
import { computed, watchEffect } from 'vue';

const appId = 'tfs_';
/** 用户认证信息存储  */
export const authInfo = useStorageAsync<
  | {
      userId: string;
      token: string;
      expiresAt: number;
    }
  | undefined
>(appId + 'authInfo_v0', null, undefined, { serializer: encryptSerializer });
export const authInfo_isLogin = computed(() => {
  return !!authInfo.value && authInfo.value.expiresAt > Date.now();
});

export const localUserPwd = useStorageAsync<{
  username: string;
  password: string;
  rememberMe: boolean;
}>(
  /** 故意使用 test 作为 key ，减少社工风险 */ appId + '__test__',
  { username: '', password: '', rememberMe: false },
  undefined,
  {
    serializer: encryptSerializer,
  },
);

/** 清楚认证信息并跳转到登录页面  */
export function authInfo_logout(/** 登录后重定向的页面地址   */ r?: string) {
  authInfo.value = undefined;
  routerUtil.push(routeMap.login, {}, { r });
}

//#region 主题功能
export const theme = useStorage<'dark' | 'light'>(appId + 'theme', null, undefined, {
  serializer: StorageSerializers.object,
});

/**  src/style.css 中也需要设置和此处一样 */
export const theme_darkModeClass = 'dark';
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

//#region i18n
export const i18nStore = useStorage<'zh-CN' | 'en'>(appId + 'i18nStore', null);
//#endregion

/** 用于控制悬浮github star按钮显示隐藏的storage key值 */
export const githubStarShow = useStorage<'show' | 'hide'>(appId + 'githubStarShow', 'show');
