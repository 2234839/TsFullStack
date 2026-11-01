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
    const expiresAt = Date.now() + SessionAuthSign.GET_SIGN_EXPIRY_MS;
    const sgin = await SessionAuthSign.signByToken(
      SessionAuthSign.buildGetSignOrigin(path, superjsonStr, expiresAt),
      token,
    );
    return `${baseServer}/api/${path}?args=${argsStr}&sign=${sgin}&session=${authInfo.value.id}&e=${expiresAt}`;
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
      }).then(async (res) => {
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
        /**
         * RPC 流式响应：后端接口返回 AsyncIterable 时切换为 SSE 传输，
         * 此处直接返回帧生成器（帧类型由接口声明，调用方 for await 消费；错误帧在生成器内抛出）
         */
        if ((res.headers.get('content-type') ?? '').includes('text/event-stream')) {
          return consumeRpcSseStream(res);
        }

        const parsed: APIResponse = await res.text().then((text) => {
          let json: SuperJSONResult;
          try {
            json = JSON.parse(text);
          } catch {
            throw MsgError.msg(`服务器返回了非 JSON 响应 (${res.status})`);
          }
          return superjson.deserialize(json) as APIResponse;
        });
        if (!parsed.error) {
          return parsed.result;
        }
        const kind = parsed.error.kind;

        /** 统一发布错误 toast */
        const errorDetail = parsed.error?.message ?? '';
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
        throw MsgError.msg(parsed.error.message ?? t('未知错误'));
      });
    }
    return remoteCall;
  }
}

/** 全局的 API 实例，方便在非 vue 组件中使用， 一般情况请使用 useAPI()   */
export const { API, AppAPI } = useAPI();

/**
 * RPC 流式帧解码：字符串帧裸传（零开销）；__sj: 前缀帧为 superjson 序列化的对象/Date 等，
 * 解码后类型与后端接口声明的 AsyncIterable<T> 的 T 一致（运行时约定，类型由 API 类型链保证）。
 */
function decodeRpcStreamFrame(payload: string): unknown {
  if (payload.startsWith('__sj:')) {
    return superjson.parse(payload.slice('__sj:'.length));
  }
  return payload;
}

/**
 * 消费 RPC 流式响应（SSE 分帧）：校验握手帧后逐帧产出接口声明的帧值，
 * 终止帧结束生成器；错误帧转为 MsgError 抛出（for await 消费端可 try/catch）。
 */
async function* consumeRpcSseStream(res: Response): AsyncGenerator<unknown> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let handshaken = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const event of events) {
        const line = event.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();

        if (!handshaken) {
          if (payload !== '__rpc_stream__') throw MsgError.msg(t('RPC 流式响应握手失败'));
          handshaken = true;
          continue;
        }
        if (payload === '[DONE]') return;
        if (payload.startsWith('__rpc_error__:')) {
          throw MsgError.msg(payload.slice('__rpc_error__:'.length));
        }
        yield decodeRpcStreamFrame(payload);
      }
    }
  } finally {
    /** 消费端提前 break/throw 时释放连接（后端检测 writable=false 会中断上游请求） */
    reader.cancel().catch(() => {});
  }
}
