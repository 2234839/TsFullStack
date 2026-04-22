import type { Effect } from 'effect';
import { MsgError } from '../util/error';

interface commonOptions {
  middleware?: ((method: string, data: unknown[], next: () => Promise<unknown>) => Promise<unknown>)[];
  // 新增：安全配置选项
  securityOptions?: {
    allowedPaths?: string[];
    forbiddenProps?: string[];
  };
}

/** 服务端远程调用，api 返回值不会解开 Effect 类型 */
export function createRPC<API_TYPE>(
  type: 'apiProvider',
  options: commonOptions & {
    genApiModule: () => Promise<API_TYPE>;
  },
): {
  API: DeepAsyncify<API_TYPE>;
  RC: (method: string, data: unknown[]) => Promise<DeepReturnTypeUnion<API_TYPE>>;
};

/** 客户端远程调用，api 返回值会解开 Effect 类型，这是由服务端的代码去实现的 Effect 处理 */
export function createRPC<API_TYPE>(
  type: 'apiConsumer',
  options: commonOptions & {
    /** 配置此选项替换默认的远程调用函数，默认逻辑采用 fetch 实现。 */
    remoteCall: (method: string, data: unknown[]) => Promise<unknown>;
  },
): {
  API: DeepAsyncEffect<API_TYPE>;
  RC: (method: string, data: unknown[]) => Promise<DeepUnEffectReturnTypeUnion<API_TYPE>>;
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
          remoteCall: (method: string, data: unknown[]) => Promise<unknown>;
        },
      ]
) {
  const remoteCall = type === 'apiConsumer' ? options.remoteCall : undefined;

  // 默认的安全配置
  const securityOptions = options.securityOptions || {};
  const forbiddenProps = new Set([
    '__proto__',
    'constructor',
    'prototype',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
    ...(securityOptions.forbiddenProps || []),
  ]);

  // 白名单路径检查函数
  const isAllowedPath = (method: string): boolean => {
    if (!securityOptions.allowedPaths || securityOptions.allowedPaths.length === 0) {
      return true; // 如果没有设置白名单，则默认允许所有路径
    }
    return securityOptions.allowedPaths.some((allowedPath) => {
      // 支持通配符匹配，例如 "user.*" 匹配 "user.getProfile", "user.updateSettings" 等
      if (allowedPath.endsWith('.*')) {
        const prefix = allowedPath.slice(0, -2);
        return method === prefix || method.startsWith(prefix + '.');
      }
      return method === allowedPath;
    });
  };

  async function RC<K extends string>(
    method: K,
    data: unknown[],
  ): Promise<DeepReturnTypeUnion<API_TYPE>> {
    // 安全检查：验证方法路径是否在白名单中
    if (!isAllowedPath(method)) {
      throw MsgError.msg(`方法 ${method} 不在允许的路径白名单中`);
    }

    // 洋葱路由的核心逻辑
    async function executeMiddleware(index: number): Promise<unknown> {
      if (options.middleware && index < options.middleware.length) {
        return options.middleware[index]?.(method, data, () => executeMiddleware(index + 1));
      } else {
        return executeCall();
      }
    }

    async function executeCall(): Promise<unknown> {
        if (type === 'apiProvider') {
          const apiModule = await options.genApiModule();
          const methodParts = method.split('.');

          // 安全检查：检查每个属性部分是否在黑名单中
          for (const part of methodParts) {
            if (forbiddenProps.has(part)) {
              throw MsgError.msg(`禁止访问敏感属性: ${part}`);
            }
          }

          // 动态属性访问链 — any 不可避免：API 模块嵌套路径深度在编译期不可确定
          let currentObj: unknown = apiModule;
          for (const part of methodParts) {
            if (currentObj == null || typeof currentObj !== 'object') {
              throw MsgError.msg(`方法 ${method} 未找到`);
            }
            currentObj = (currentObj as Record<string, unknown>)[part];
            if (!currentObj) {
              throw MsgError.msg(`方法 ${method} 未找到`);
            }
          }

          if (typeof currentObj === 'function') {
            // 安全检查：确保调用的是普通函数，而不是绑定函数或其他特殊函数
            if (currentObj.toString().includes('[native code]')) {
              throw MsgError.msg(`禁止调用原生方法`);
            }

            return await (currentObj as (...args: unknown[]) => unknown)(...data);
          } else {
            throw MsgError.msg(`${method} 不是一个函数`);
          }
        } else {
          return await remoteCall!(method, data);
        }
    }

    return await executeMiddleware(0) as Promise<DeepReturnTypeUnion<API_TYPE>>;
  }

  /** 创建嵌套的Proxy处理器 */
  function createNestedProxy(path: string[] = []): ProxyHandler<object> {
    return {
      get(_target, prop: string) {
        // 安全检查：阻止访问特殊属性
        if (typeof prop === 'string' && forbiddenProps.has(prop)) {
          throw MsgError.msg(`禁止访问敏感属性: ${prop}`);
        }

        if (prop === 'then') {
          // Handle the case when the proxy is accidentally treated as a Promise
          return undefined;
        }
        const newPath = [...path, prop];

        // 安全检查：验证完整路径是否在白名单中
        const fullPath = newPath.join('.');
        if (!isAllowedPath(fullPath)) {
          throw MsgError.msg(`路径 ${fullPath} 不在允许的白名单中`);
        }

        const proxyObj = new Proxy((...args: unknown[]) => {
          const method = newPath.join('.');
          return RC(method, args);
        }, createNestedProxy(newPath));
        return proxyObj;
      },
      apply(_target, _thisArg, args) {
        const method = path.join('.');
        return RC(method, args);
      },
    };
  }

  /** 包装了一次的 RC 方便跳转到函数定义  */
  const API = new Proxy(() => {}, createNestedProxy()) as unknown as DeepAsyncify<API_TYPE>;
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

/**
 * 定义递归的链式调用类型，支持结果转换
 * R 是可选的结果转换类型
 */
type ChainedProxy<T, R = [string, any[]], P extends string[] = []> = {
  [K in keyof T]: T[K] extends (...args: infer A) => any
    ? (...args: A) => R
    : ChainedProxy<T[K], R, [...P, string & K]>;
};

/**
 * 创建一个代理对象，跟踪链式调用并返回路径和参数
 * @param obj 原始对象
 * @param transform 可选的转换函数，将[路径, 参数]转换为自定义类型
 * @returns 具有完整类型提示的代理对象
 */
export function proxyCall<T extends object, R = [string, unknown[]]>(
  _obj: T,
  transform?: (result: [string, unknown[]]) => R,
): ChainedProxy<T, R> {
  let path: string[] = [];

  /** 递归代理工厂 — 返回 unknown 因为 Proxy 链式调用的静态类型无法精确表达 */
  const createProxy = (): unknown => {
    return new Proxy(function () {}, {
      // 拦截函数调用
      apply(_target, _thisArg, args: unknown[]) {
        const result: [string, unknown[]] = [path.join('.'), args];
        path = [];
        // 如果提供了转换函数，则应用转换
        return transform ? transform(result) : result;
      },
      // 拦截属性访问
      get(_target, prop, _receiver) {
        if (typeof prop === 'string' && prop !== 'then') {
          // 避免与Promise冲突
          path.push(prop);
          return createProxy();
        }
        return undefined;
      },
    });
  };

  // 创建顶层代理
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop, _receiver) {
      if (typeof prop === 'string' && prop !== 'then') {
        path.push(prop);
        return createProxy();
      }
      return undefined;
    },
  };

  return new Proxy({}, handler) as ChainedProxy<T, R>;
}
