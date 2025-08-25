import { storage } from '#imports';
import { useDebounceFn, useThrottleFn } from '@vueuse/core';
import { customRef, onUnmounted } from 'vue';

/**
 * Options for defining a WXT storage item
 */
type WxtStorageItemOptions<Tvalue> = Parameters<typeof storage.defineItem<Tvalue>>[1];

/**
 * Key type for WXT storage items
 */
type WxtStorageKey = Parameters<typeof storage.defineItem>[0];

/**
 * Versioned storage interface that wraps values with version control and writer identification
 * @template TValue - Type of the stored value
 */
interface VersionedStorage<TValue> {
  /** The actual stored value */
  value: TValue;
  /** Version number for conflict resolution and synchronization */
  version: number;
  /** Unique identifier of the instance that last wrote the value */
  writerId: string;
}

/**
 * 创建一个响应式的浏览器扩展存储工具，能够在多个实例（不同标签页、后台脚本、弹出窗口等）之间同步数据
 * ，具有近似实时更新（100ms 节流）。
 *
 * 此函数提供一个 Vue 响应式 ref，自动在所有扩展上下文中同步更改，
 * 使用版本控制来防止冲突并确保数据一致性。
 *
 * @template TValue - 要存储的值的类型
 * @param {WxtStorageKey} key - 存储项的键名
 * @param {WxtStorageItemOptions<TValue> & Required<Pick<WxtStorageItemOptions<TValue>, 'fallback'>>} options -
 *   存储选项，必须提供 fallback 值以防止 storageRef 为 undefined（除非 fallback 本身支持 undefined）
 *
 * @returns {Ref<TValue>} 一个在所有扩展上下文中自动同步的 Vue 响应式 ref
 */
export function useWxtStorage<TValue>(
  key: WxtStorageKey,
  options: WxtStorageItemOptions<TValue> &
    /** 约束 fallback 必传，这样可以避免 storageRef 为 undefined 的情况出现（除非fallback本身就支持 undefined） */
    Required<Pick<WxtStorageItemOptions<TValue>, 'fallback'>>,
) {
  const devLog = import.meta.env.DEV ? console.log.bind(console) : (...arg: any[]) => {};

  const versionedKey: WxtStorageKey = `${key}_versioned` as WxtStorageKey;
  const wxtStorage = storage.defineItem<VersionedStorage<TValue>>(versionedKey, {
    fallback: {
      value: options.fallback,
      version: 0,
      writerId: '',
    },
  });

  let currentVersion = 0;

  // 每个实例的唯一标识，用于区分自己的写入
  const instanceId = Math.random().toString(36).substring(2, 11);

  let unWatch = () => {};
  onUnmounted(unWatch);

  function createReactiveDeepProxy<T extends object>(
    target: T,
    onSet: (value: T) => void,
    track: () => void,
    trigger: () => void,
  ): T {
    const proxyCache = new WeakMap<object, any>();
    // 第一次的值从远程获取，并触发本地更新
    wxtStorage.getValue().then((v) => {
      if (v && v.version > currentVersion) {
        currentVersion = v.version;
        devLog('第一次获取远程值并覆盖本地值', target, '->', v.value);
        Object.assign(target, v.value);
        trigger();
      }
    });

    // 其他实例的更新直接写 storageRef
    unWatch = wxtStorage.watch((v) => {
      if (v && v.version > currentVersion) {
        currentVersion = v.version;
        devLog(`watch external(version:${v.version} writerId:${v.writerId}) update: `, v.value);
        Object.assign(target, v.value);
        trigger();
      }
    });

    /**
     * Creates a proxy for an object with Vue reactivity support
     * @param {any} obj - The object to proxy
     * @returns {any} A reactive proxy of the object
     */
    function createProxy(obj: any): any {
      if (typeof obj !== 'object' || obj === null || Object.isFrozen(obj)) {
        return obj;
      }

      if (proxyCache.has(obj)) {
        return proxyCache.get(obj);
      }

      const proxy = new Proxy(obj, {
        get(target, prop, receiver) {
          track(); // Vue 依赖追踪
          const value = Reflect.get(target, prop, receiver);

          if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
            return createProxy(value);
          }

          return value;
        },

        set(target, prop, value, receiver) {
          const oldValue = Reflect.get(target, prop, receiver);

          if (oldValue !== value) {
            const result = Reflect.set(target, prop, value, receiver);
            if (result) {
              trigger(); // Vue 更新触发
              onSet(target as T);
            }
            return result;
          }

          return true;
        },
      });

      proxyCache.set(obj, proxy);
      return proxy;
    }
    const proxyValue = createProxy(target);
    return proxyValue;
  }

  // 使用 customRef 创建支持 Vue 响应式的深度拦截 ref
  const deepRef = customRef<TValue>((track, trigger) => {
    let proxyValue = createReactiveDeepProxy(
      options.fallback as object,
      handleDeepSet,
      track,
      trigger,
    ) as TValue;

    /**
     * Unified save function with throttling to prevent high-frequency disk writes
     * @param {TValue} value - The value to save
     * @param {boolean} [isDeep=false] - Whether this is a deep object modification
     */
    const saveValue = useThrottleFn(
      (value: TValue, isDeep: boolean = false) => {
        const newVersion = currentVersion + 1;
        const versionedValue: VersionedStorage<TValue> = {
          value: value,
          version: newVersion,
          writerId: instanceId,
        };

        wxtStorage.setValue(versionedValue);
        currentVersion = newVersion;

        const logPrefix = isDeep ? 'deep save:' : 'save:';
        devLog(logPrefix, value, 'version:', newVersion, 'writer:', instanceId);
      },
      100,
      true,
    );

    /**
     * Callback handler for deep proxy modifications
     * @param {object} value - The modified object value
     */
    function handleDeepSet(value: object) {
      saveValue(value as TValue, true);
    }

    return {
      get() {
        track();
        return proxyValue;
      },

      set(newValue) {
        // 保存新值
        saveValue(newValue);

        trigger();
      },
    };
  });

  return deepRef;
}
