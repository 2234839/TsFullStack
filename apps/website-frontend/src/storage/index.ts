import { routeMap, routerUtil } from "@/router";
import { useAPI } from "@/api";
import type { loginByEmailPwd_res } from "@/utils/apiType";
import { useApiStorage } from "@/utils/hooks/UseApiStorage";
import { encryptSerializer } from "@/utils/encryptSerializer";
import {
  createSharedComposable,
  StorageSerializers,
  useStorage,
  useStorageAsync,
} from "@vueuse/core";
import { computed, watchEffect } from "vue";
import { DEFAULT_OPENAI_BASE_URL, DEFAULT_MAX_TOKENS } from "@/utils/constants";
export const appId = "tfs_";
/** 用户认证信息存储  */
export const authInfo = useStorageAsync<loginByEmailPwd_res>(
  appId + "authInfo_v0",
  null,
  undefined,
  { serializer: encryptSerializer },
);
export const authInfo_isLogin = computed(() => {
  return !!authInfo.value && new Date(authInfo.value.expiresAt).getTime() > Date.now();
});

export const localUserPwd = useStorageAsync<{
  username: string;
  password: string;
  rememberMe: boolean;
}>(
  /** v2: 密钥派生方式变更（SHA-256），不兼容旧数据 */ appId + "__test_v2__",
  { username: "", password: "", rememberMe: false },
  undefined,
  {
    serializer: encryptSerializer,
  },
);

/** 清除认证信息并跳转到登录页面  */
export function authInfo_logout(/** 登录后重定向的页面地址   */ r?: string) {
  const wasLogin = authInfo_isLogin.value;
  if (wasLogin) {
    /**
     * 必须先发起服务端会话撤销再清空本地 token：
     * 请求头在调用时同步构造，若先置 null 则请求不带 x-token-id，服务端无法定位会话，撤销必然失败
     */
    void useAPI()
      .API.system.logout()
      .catch(() => {
        /** 服务端撤销失败时 token 仍会随过期时间失效，本地凭据已清除 */
      });
  }
  authInfo.value = null;
  routerUtil.push(routeMap.login, {}, r ? { r } : undefined);
}

//#region 主题功能
/** 开发环境随机主题选项 */
export const theme_randomMode = useStorage<boolean>(appId + "theme_randomMode", false);

export const theme = useStorage<"dark" | "light">(appId + "theme", null, undefined, {
  serializer: StorageSerializers.object,
});

/**  src/style.css 中也需要设置和此处一样 */
export const theme_darkModeClass = "dark";

export const theme_isDark = computed<boolean>({
  set(v) {
    theme.value = v ? "dark" : "light";
  },
  get() {
    return theme.value === "dark";
  },
});
watchEffect(() => {
  document.documentElement.classList.toggle(theme_darkModeClass, theme_isDark.value);
});

//#endregion 主题功能

//#region i18n
export const i18nStore = useStorage<"zh-CN" | "en">(appId + "i18nStore", null);
//#endregion

/** 用于控制悬浮github star按钮显示隐藏的storage key值 */
export const githubStarShow = useStorage<"show" | "hide">(appId + "githubStarShow", "show");

//#region OpenAI 配置
export interface OpenAIConfig {
  /** OpenAI API Base URL */
  baseURL: string;
  /** OpenAI API Key */
  apiKey: string;
  /** 使用的模型 */
  model: string;
  /** 最大token数 */
  maxTokens: number;
  /** 温度参数 */
  temperature: number;
}

/** OpenAI 配置存储 */
export const useOpenAIConfig = createSharedComposable(function () {
  return useApiStorage<OpenAIConfig>(
    appId + "openAIConfig",
    {
      baseURL: DEFAULT_OPENAI_BASE_URL,
      apiKey: "",
      model: "gpt-3.5-turbo",
      maxTokens: DEFAULT_MAX_TOKENS,
      temperature: 0.7,
    },
    {
      mergeDefaults: true,
      pollingInterval: 35_500,
    },
  );
});
//#endregion
