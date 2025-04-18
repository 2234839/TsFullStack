import {
  createRPC,
  type API as __API__,
  type AppAPI as __AppAPI__,
  type MsgErrorOpValues,
} from 'tsfullstack-backend';
import superjson from 'superjson';
import { authInfo } from './storage';
import { routeMap, routerUtil } from './router';
import { useToast } from 'primevue';

const baseServer = import.meta.env.DEV ? 'http://localhost:5209' : '';

export const { API } = createRPC<__API__>('apiConsumer', {
  remoteCall: genRemoteCall(`${baseServer}/api/`),
});
export const { API: AppAPI } = createRPC<__AppAPI__>('apiConsumer', {
  remoteCall: genRemoteCall(`${baseServer}/app-api/`),
});
function genRemoteCall(baseUrl: string) {
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
        console.log('[err]', res);
        const op = res.error.op as MsgErrorOpValues | undefined;
        if (!res.error.op) {
          throw res.error;
        } else if (op === 'op_toLogin') {
          routerUtil.push(routeMap.login, {});
        }
      });
  }
  return remoteCall;
}

/** 方便组件调用时进行一些定制操作 */
export function useAPI() {
  const { API } = createRPC<__API__>('apiConsumer', {
    remoteCall: genPostRemoteCall(`${baseServer}/api/`),
  });
  const { API: AppAPI } = createRPC<__AppAPI__>('apiConsumer', {
    remoteCall: genPostRemoteCall(`${baseServer}/app-api/`),
  });
  const toast = useToast();
  return { API, AppAPI };
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
          console.log('[err]', res);
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

