/** npm lib 的形式引用：有完善的类型，在 monorepo 项目中可以通过 .d.ts.map 跳转到后端 api 的定义代码位置 */
import {
  createRPC,
  proxyCall,
  type API as __API__,
  type AppAPI as __AppAPI__,
  MsgError,
  type MsgErrorOpValues,
  SessionAuthSign,
} from '@tsfullstack/backend';

import superjson from 'superjson';
import { routeMap, routerUtil } from './router';
import { t } from '@/i18n';

/** RPC 响应的统一结构 */
interface APIResponse<T = unknown> {
  result?: T;
  error?: {
    op?: MsgErrorOpValues;
    message?: string;
  };
}
import { authInfo } from './storage';
import { toastBus, authBus } from './buses';
const baseServer = import.meta.env.VITE_API_BASE_URL || '';

/** 方便组件调用时进行一些定制操作 */
export function useAPI() {
  const { API } = createRPC<__API__>('apiConsumer', {
    remoteCall: genPostRemoteCall(`${baseServer}/api/`),
  });
  const { API: AppAPI } = createRPC<__AppAPI__>('apiConsumer', {
    remoteCall: genPostRemoteCall(`${baseServer}/app-api/`),
  });

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
      if (data[0] instanceof File) {
        const formData = new FormData();
        formData.append('file', data[0]);
        body = formData;
        content_type = undefined;
      } else {
        body = superjson.stringify(data);
        content_type = 'application/json';
      }
      return fetch(`${baseUrl}${method}`, {
        method: 'POST',
        body,
        headers: content_type
          ? {
              'Content-Type': content_type,
              'x-token-id': authInfo.value?.token ?? '',
            }
          : { 'x-token-id': authInfo.value?.token ?? '' },
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
              op: MsgError.op_msgError,
            });
            /** 抛出错误，让调用方能够捕获 */
            throw new MsgError(MsgError.op_msgError, errorMessage);
          }
          return res.json();
        })
        .then((r) => {
          const res = superjson.deserialize(r) as APIResponse;
          if (!res.error) {
            return res.result;
          }
          const op = res.error.op as MsgErrorOpValues | undefined;

          /** 统一发布错误 toast */
          const errorDetail = res.error?.message ?? '';
          const publishErrorToast = () => {
            toastBus.publish({
              variant: 'error',
              summary: t('错误'),
              detail: errorDetail,
              life: 3000,
              op,
            });
          };

          if (op === MsgError.op_logout) {
            authBus.publish(MsgError.op_logout);
            publishErrorToast();
          } else if (op === MsgError.op_toLogin) {
            routerUtil.push(routeMap.login, {});
            publishErrorToast();
          } else {
            publishErrorToast();
          }
          throw res.error;
        });
    }
    return remoteCall;
  }
}

/** 全局的 API 实例，方便在非 vue 组件中使用， 一般情况请使用 useAPI()   */
export const { API, AppAPI } = useAPI();
