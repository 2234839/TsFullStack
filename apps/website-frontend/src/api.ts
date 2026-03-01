/** npm lib 的形式引用：有完善的类型，在 monorepo 项目中可以通过 .d.ts.map 跳转到后端 api 的定义代码位置 */
import {
  createRPC,
  proxyCall,
  type API as __API__,
  type AppAPI as __AppAPI__,
  type MsgErrorOpValues,
  SessionAuthSign,
} from '@tsfullstack/backend';
/** 直接引用后端 ts，有完善的类型，可以直接跳转定义，并且可以查看变量引用。但是 vue-tsc 过不去,暂时没想到解决的好办法，只能作为开发时方便使用的临时方案 */
// import type { API as __API__, AppAPI as __AppAPI__, MsgErrorOpValues } from '../../backend/src/lib';

import superjson from 'superjson';
import { routeMap, routerUtil } from './router';
import { authInfo } from './storage';
import { toastBus } from './utils/toastBus';
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
            // 发布到 toast 总线，不依赖传入的 toast 参数
            toastBus.publish({
              variant: 'error',
              summary: 'Error',
              detail: res.error.message,
              life: 3000,
            });
          } else if (op === 'op_msgError') {
            toastBus.publish({
              variant: 'error',
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

/** 全局的 API 实例，方便在非 vue 组件中使用， 一般情况请使用 useAPI()   */
export const { API, AppAPI } = useAPI();
