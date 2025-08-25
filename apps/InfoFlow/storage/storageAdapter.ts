import { customRef, onUnmounted } from 'vue';
import { useThrottleFn } from '@vueuse/core';

/**
 * Versioned storage interface that wraps values with version control and writer identification
 * @template TValue - Type of the stored value
 */
export interface VersionedStorage<TValue> {
  /** The actual stored value */
  value: TValue;
  /** Version number for conflict resolution and synchronization */
  version: number;
  /** Unique identifier of the instance that last wrote the value */
  writerId: string;
}

/**
 * Generic storage adapter interface that defines the contract for storage implementations
 * @template TValue - Type of the stored value
 */
export interface StorageAdapter<TValue> {
  /**
   * Get the current value from storage
   * @returns Promise<TValue> The stored value
   */
  getValue(): Promise<VersionedStorage<TValue> | null>;

  /**
   * Set a value in storage
   * @param value The versioned value to store
   */
  setValue(value: VersionedStorage<TValue>): Promise<void> | void;

  /**
   * Watch for changes in storage
   * @param callback Function to call when value changes
   * @returns Function to unsubscribe from changes
   */
  watch(callback: (value: VersionedStorage<TValue> | null) => void): () => void;
}

/**
 * Options for creating a reactive storage ref
 */
export interface ReactiveStorageOptions<TValue> {
  /** Fallback value when storage is empty */
  fallback: TValue;
  /** Throttle delay for saving changes (default: 100ms) */
  throttleDelay?: number;
  /** Enable debug logging in development */
  enableDebugLog?: boolean;
}

/**
 * Create a reactive storage ref that works with any storage adapter
 * @template TValue - Type of the stored value
 * @param adapter Storage adapter implementation
 * @param options Configuration options
 * @returns Vue reactive ref that synchronizes with storage
 */
export function useReactiveStorage<TValue>(
  adapter: StorageAdapter<TValue>,
  options: ReactiveStorageOptions<TValue>
) {
  const { fallback, throttleDelay = 100, enableDebugLog = false } = options;

  const devLog = enableDebugLog ? console.log.bind(console) : () => {};

  let currentVersion = 0;
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

    // Initial value fetch from remote storage
    adapter.getValue().then((v) => {
      if (v && v.version > currentVersion) {
        currentVersion = v.version;
        devLog('Initial remote value loaded:', target, '->', v.value);
        Object.assign(target, v.value);
        trigger();
      }
    });

    // Watch for external changes
    unWatch = adapter.watch((v) => {
      if (v && v.version > currentVersion) {
        currentVersion = v.version;
        devLog(`External update (version:${v.version} writerId:${v.writerId}):`, v.value);
        Object.assign(target, v.value);
        trigger();
      }
    });

    function createProxy(obj: any): any {
      if (typeof obj !== 'object' || obj === null || Object.isFrozen(obj)) {
        return obj;
      }

      if (proxyCache.has(obj)) {
        return proxyCache.get(obj);
      }

      const proxy = new Proxy(obj, {
        get(target, prop, receiver) {
          track();
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
              trigger();
              console.log('[target, prop, value, receiver]',target, prop, value, receiver);
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

  const deepRef = customRef<TValue>((track, trigger) => {
    let proxyValue = createReactiveDeepProxy(
      fallback as object,
      handleDeepSet,
      track,
      trigger,
    ) as TValue;

    const saveValue = useThrottleFn(
      (value: TValue, isDeep: boolean = false) => {
        const newVersion = currentVersion + 1;
        const versionedValue: VersionedStorage<TValue> = {
          value: value,
          version: newVersion,
          writerId: instanceId,
        };

        adapter.setValue(versionedValue);
        currentVersion = newVersion;

        const logPrefix = isDeep ? 'Deep save:' : 'Save:';
        devLog(logPrefix, value, 'version:', newVersion, 'writer:', instanceId);
      },
      throttleDelay,
      true,
    );

    function handleDeepSet(value: object) {
      saveValue(value as TValue, true);
    }

    return {
      get() {
        track();
        return proxyValue;
      },

      set(newValue) {
        saveValue(newValue);
        trigger();
      },
    };
  });

  return deepRef;
}