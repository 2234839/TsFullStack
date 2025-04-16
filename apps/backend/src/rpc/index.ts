/** ═════════🏳‍🌈 超轻量级的远程调用，完备的类型提示！ 🏳‍🌈═════════  */

import type { Effect } from 'effect';

interface commonOptions {
  middleware?: ((method: string, data: any[], next: () => Promise<any>) => Promise<any>)[]; // 统一的中间件
}
/** 服务端远程调用，api 返回值不会解开 Effect 类型 */
export function createRPC<API_TYPE>(
  type: 'apiProvider',
  options: commonOptions & {
    genApiModule: () => Promise<API_TYPE>;
  },
): {
  API: DeepAsyncify<API_TYPE>;
  RC: (method: string, data: any[]) => Promise<DeepReturnTypeUnion<API_TYPE>>;
};
/** 客户端远程调用，api 返回值会解开 Effect 类型，这是由服务端的代码去实现的 Effect 处理 */
export function createRPC<API_TYPE>(
  type: 'apiConsumer',
  options: commonOptions & {
    /** 配置此选项替换默认的远程调用函数，默认逻辑采用 fetch 实现。 */
    remoteCall: (method: string, data: any[]) => Promise<any>; // 远程调用函数
  },
): {
  API: DeepAsyncEffect<API_TYPE>;
  RC: (method: string, data: any[]) => Promise<DeepUnEffectReturnTypeUnion<API_TYPE>>;
};
export function createRPC<API_TYPE>(
  ...[type, options]:
    | [
        'apiProvider',
        commonOptions & {
          genApiModule: () => Promise<API_TYPE>;
        },
      ]
    | [
        'apiConsumer',
        commonOptions & {
          /** 配置此选项替换默认的远程调用函数，默认逻辑采用 fetch 实现。 */
          remoteCall: (method: string, data: any[]) => Promise<any>; // 远程调用函数
        },
      ]
) {
  const remoteCall = type === 'apiConsumer' ? options.remoteCall : undefined;

  async function RC<K extends string>(
    method: K,
    data: any[],
  ): Promise<DeepReturnTypeUnion<API_TYPE>> {
    console.log('[method]', method, data);
    // 洋葱路由的核心逻辑
    async function executeMiddleware(index: number): Promise<any> {
      if (options.middleware && index < options.middleware.length) {
        return options.middleware[index]?.(method, data, () => executeMiddleware(index + 1));
      } else {
        return executeCall();
      }
    }

    async function executeCall(): Promise<any> {
      try {
        if (type === 'apiProvider') {
          const apiModule = type === 'apiProvider' ? await options.genApiModule() : undefined;

          const methodParts = method.split('.');
          let currentObj: any = apiModule;
          for (const part of methodParts) {
            currentObj = currentObj?.[part];
            if (!currentObj) throw new Error(`Method ${method} not found`);
          }
          if (typeof currentObj === 'function') {
            return await currentObj(...data);
          } else {
            throw new Error(`${method} is not a function`);
          }
        } else {
          return await remoteCall!(method, data);
        }
      } catch (error) {
        throw error;
      }
    }

    return await executeMiddleware(0);
  }

  /** Remote call ， 会就近的选择是远程调用还是使用本地函数 */

  /** 创建嵌套的Proxy处理器 */
  function createNestedProxy(path: string[] = []): ProxyHandler<object> {
    return {
      get(_target, prop: string) {
        if (prop === 'then') {
          // Handle the case when the proxy is accidentally treated as a Promise
          return undefined;
        }
        const newPath = [...path, prop];
        return new Proxy(function (...args: any[]) {
          const method = newPath.join('.');
          return RC(method, args);
        }, createNestedProxy(newPath));
      },
      apply(_target, _thisArg, args) {
        const method = path.join('.');
        return RC(method, args);
      },
    };
  }
  /** 包装了一次的 RC 方便跳转到函数定义  */
  const API = new Proxy(function () {}, createNestedProxy()) as unknown as DeepAsyncify<API_TYPE>;
  return { API, RC };
}

/** 获取函数的返回值类型，并将其包裹在 Promise 中  */
export type AsyncifyReturnType<T> = T extends (...args: any[]) => infer R
  ? (...args: Parameters<T>) => Promise<Awaited<R>>
  : T;
export type AsyncifyUnEffectReturnType<T> = T extends (...args: any[]) => infer R
  ? (...args: Parameters<T>) => Promise<ExtractEffectSuccess<Awaited<R>>>
  : T;
/** 因为如果是远程调用，那么返回值肯定要是 promise （网络异步的特性决定的），所以使用这个类型来将所有返回值的类型包裹一层promise */
export type DeepAsyncify<T> = T extends (...args: any[]) => any
  ? AsyncifyReturnType<T>
  : T extends object
  ? { [K in keyof T]: DeepAsyncify<T[K]> }
  : T;
/** 如果是客户端调用，服务端必须要已经处理了 Effect ，所以返回的就是解开来 Effect 的*/
export type DeepAsyncEffect<T> = T extends (...args: any[]) => any
  ? AsyncifyUnEffectReturnType<T>
  : T extends object
  ? { [K in keyof T]: DeepAsyncEffect<T[K]> }
  : T;

/** 获取一个深度嵌套的对象（apis）上的函数的返回值联合类型
 * 这是一个辅助类型，方便程序无遗漏的处理所有可能的返回值类型
 */
export type DeepReturnTypeUnion<T> = T extends (...args: any[]) => any
  ? Awaited<ReturnType<T>>
  : T extends object
  ? { [K in keyof T]: DeepReturnTypeUnion<T[K]> }[keyof T]
  : never;

export type DeepUnEffectReturnTypeUnion<T> = T extends (...args: any[]) => any
  ? ExtractEffectSuccess<Awaited<ReturnType<T>>>
  : T extends object
  ? { [K in keyof T]: DeepUnEffectReturnTypeUnion<T[K]> }[keyof T]
  : never;
/** 解开可能是 Effect 的返回值，如果是 Effect 则返回其成功类型，否则返回原类型 */
export type ExtractEffectSuccess<T> = T extends Effect.Effect<infer A, infer E, infer P> ? A : T;
