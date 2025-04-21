import {
  createRPC,
  proxyCall,
  type API as __API__,
  type AppAPI as __AppAPI__,
  type MsgErrorOpValues,
} from 'tsfullstack-backend';
import superjson from 'superjson';
import { authInfo } from './storage';
import { routeMap, routerUtil } from './router';
import { useToast } from 'primevue';
import { type ToastMessageOptions } from 'primevue/toast';
const baseServer = import.meta.env.DEV ? 'http://localhost:5209' : '';

/** 全局的 API 实例，方便在非 vue 组件中使用， 一般情况请使用 useAPI()   */
export const { API, AppAPI } = useAPI(function () {
  return {
    add(message: ToastMessageOptions) {
      alert(message.summary);
    },
    remove(_message: ToastMessageOptions) {},
    removeGroup(_group: string) {},
    removeAllGroups() {},
  };
});

/** 方便组件调用时进行一些定制操作 */
export function useAPI(useToastFn = useToast) {
  const { API } = createRPC<__API__>('apiConsumer', {
    remoteCall: genPostRemoteCall(`${baseServer}/api/`),
  });
  const { API: AppAPI } = createRPC<__AppAPI__>('apiConsumer', {
    remoteCall: genPostRemoteCall(`${baseServer}/app-api/`),
  });
  const toast = useToastFn();

  /** 生成 API 请求 get 形式的 URL，方便在某些场景下使用，例如生成可以直接访问的文件/图片 url 下载链接 */
  const APIGetUrl = proxyCall(API, ([path, args]) => {
    const x_token_id = authInfo.value?.token;
    return `${baseServer}/api/${path}?${
      x_token_id ? `x_token_id=${x_token_id}&` : ''
    }args=${encodeURIComponent(superjson.stringify(args))}`;
  });
  const AppAPIGetUrl = proxyCall(AppAPI, ([path, args]) => {
    return `${baseServer}/app-api/${path}?args=${encodeURIComponent(superjson.stringify(args))}`;
  });
  return { API, AppAPI, APIGetUrl, AppAPIGetUrl };

  function genPostRemoteCall(baseUrl: string) {
    function remoteCall(method: string, data: any[]) {
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
        .then((res) => res.json())
        .then((r) => {
          const res = superjson.deserialize(r) as any;
          if (!res.error) {
            return res.result;
          }
          console.log('[err]', res.error);
          const op = res.error.op as MsgErrorOpValues | undefined;
          if (op === 'op_toLogin') {
            routerUtil.push(routeMap.login, {});
            toast.add({
              severity: 'error',
              summary: 'Error',
              detail: res.error.message,
              life: 3000,
            });
          } else if (op === 'op_msgError') {
            toast.add({
              severity: 'error',
              summary: 'Error',
              detail: res.error.message,
              life: 3000,
            });
          }
          throw res.error;
        });
    }
    return remoteCall;
  }
}
