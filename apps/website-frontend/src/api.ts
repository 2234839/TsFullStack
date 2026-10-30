/** npm lib 的形式引用：有完善的类型，在 monorepo 项目中可以通过 .d.ts.map 跳转到后端 api 的定义代码位置 */
import {
  createRPC,
  proxyCall,
  type API as __API__,
  type AppAPI as __AppAPI__,
  MsgError,
  SessionAuthSign,
} from '@tsfullstack/backend';

import superjson, { type SuperJSONResult } from 'superjson';
import { routeMap, router, routerUtil } from './router';
import { t } from '@/i18n';

import type { AsyncAPI } from '@/utils/apiType';

/** 错误动作类型：后端 handleCause 按 _tag 输出 kind */
export type ErrorKind = 'MsgError' | 'LogoutError' | 'ToLoginError';

/** RPC 响应的统一结构 */
interface APIResponse<T = unknown> {
  result?: T;
  error?: {
    kind?: ErrorKind;
    message?: string;
  };
}
import { authInfo } from './storage';
import { toastBus, authBus } from './buses';
const baseServer = import.meta.env.VITE_API_BASE_URL || '';

/** 方便组件调用时进行一些定制操作 */
export function useAPI() {
  const { API: _API } = createRPC<__API__>('apiConsumer', {
    remoteCall: genPostRemoteCall(`${baseServer}/api/`),
  });
  const { API: _AppAPI } = createRPC<__AppAPI__>('apiConsumer', {
    remoteCall: genPostRemoteCall(`${baseServer}/app-api/`),
  });
  const API = _API as unknown as AsyncAPI<__API__>;
  const AppAPI = _AppAPI as unknown as AsyncAPI<__AppAPI__>;

  /** 生成 API 请求 get 形式的 URL，方便在某些场景下使用，例如生成可以直接访问的文件/图片 url 下载链接 */
  const APIGetUrl = proxyCall(API, async ([path, args]) => {
    const token = authInfo.value?.token;
    if (!token) {
      throw new Error('APIGetUrl requires auth token');
    }
    const superjsonStr = superjson.stringify(args);
    const argsStr = encodeURIComponent(superjsonStr);
    const sgin = await SessionAuthSign.signByToken(superjsonStr, token);
    return `${baseServer}/api/${path}?args=${argsStr}&sign=${sgin}&session=${authInfo.value.id}`;
  });
  const AppAPIGetUrl = proxyCall(AppAPI, ([path, args]) => {
    const superjsonStr = superjson.stringify(args);
    const argsStr = encodeURIComponent(superjsonStr);
    return `${baseServer}/app-api/${path}?args=${argsStr}`;
  });
  return { API, AppAPI, APIGetUrl, AppAPIGetUrl };

  function genPostRemoteCall(baseUrl: string) {
    function remoteCall(method: string, data: unknown[]) {
      let body: BodyInit;
      let content_type;
      let requestUrl = `${baseUrl}${method}`;
      if (data[0] instanceof File) {
        const formData = new FormData();
        formData.append('file', data[0]);
        body = formData;
        content_type = undefined;
        if (data.length > 1) {
          requestUrl += `?args=${encodeURIComponent(superjson.stringify(data.slice(1)))}`;
        }
      } else {
        body = superjson.stringify(data);
        content_type = 'application/json';
      }
      const headers: Record<string, string> = {
        'x-token-id': authInfo.value?.token ?? '',
      };
      if (content_type) headers['Content-Type'] = content_type;

      return fetch(requestUrl, {
        method: 'POST',
        body,
        headers,
      })
        .then(async (res) => {
          /** 检查 HTTP 状态码，处理服务器错误（502、503、504 等） */
          if (!res.ok) {
            /** 常见 HTTP 错误状态码的友好提示 */
            const errorMessages: Record<number, string> = {
              400: t('请求参数错误'),
              401: t('未授权，请重新登录'),
              403: t('没有权限访问'),
              404: t('请求的资源不存在'),
              500: t('服务器内部错误'),
              502: t('网关错误，服务暂时不可用'),
              503: t('服务暂时不可用'),
              504: t('请求超时，服务器响应时间过长'),
            };
            const errorMessage = errorMessages[res.status] || t(`请求失败 (${res.status})`);
            /** 显示错误提示 */
            toastBus.publish({
              variant: 'error',
              summary: t('网络错误'),
              detail: errorMessage,
              life: 5000,
            });
            /** 抛出错误，让调用方能够捕获 */
            throw MsgError.msg(errorMessage);
          }
          return res.text().then((text) => {
            let parsed: SuperJSONResult;
            try {
              parsed = JSON.parse(text);
            } catch {
              throw MsgError.msg(`服务器返回了非 JSON 响应 (${res.status})`);
            }
            return superjson.deserialize(parsed) as APIResponse;
          });
        })
        .then((res) => {
          if (!res.error) {
            return res.result;
          }
          const kind = res.error.kind;

          /** 统一发布错误 toast */
          const errorDetail = res.error?.message ?? '';
          const publishErrorToast = () => {
            toastBus.publish({
              variant: 'error',
              summary: t('错误'),
              detail: errorDetail,
              life: 3000,
            });
          };

          if (kind === 'LogoutError') {
            authBus.publish('logout');
            publishErrorToast();
          } else if (kind === 'ToLoginError') {
            /** 带上当前页面地址，登录后回跳原页面（已是登录页时不带，避免死循环） */
            const current = router.currentRoute.value;
            const r = current.path === routeMap.login.path ? undefined : current.fullPath;
            routerUtil.push(routeMap.login, {}, r ? { r } : undefined);
            publishErrorToast();
          } else {
            publishErrorToast();
          }
          throw MsgError.msg(res.error.message ?? t('未知错误'));
        });
    }
    return remoteCall;
  }
}

/** 全局的 API 实例，方便在非 vue 组件中使用， 一般情况请使用 useAPI()   */
export const { API, AppAPI } = useAPI();
