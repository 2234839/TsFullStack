import { storage } from '#imports';
import { useReactiveStorage, type StorageAdapter, type VersionedStorage } from './storageAdapter';

/**
 * Options for defining a WXT storage item
 */
type WxtStorageItemOptions<Tvalue> = Parameters<typeof storage.defineItem<Tvalue>>[1];

/**
 * Key type for WXT storage items
 */
type WxtStorageKey = Parameters<typeof storage.defineItem>[0];

/**
 * WXT storage adapter implementation
 */
class WxtStorageAdapter<TValue> implements StorageAdapter<TValue> {
  private wxtStorage: ReturnType<typeof storage.defineItem<VersionedStorage<TValue>>>;

  constructor(key: WxtStorageKey, fallback: TValue) {
    const versionedKey = key;
    this.wxtStorage = storage.defineItem<VersionedStorage<TValue>>(versionedKey, {
      fallback: {
        value: fallback,
        version: 0,
        writerId: '',
      },
    });
  }

  async getValue(): Promise<VersionedStorage<TValue> | null> {
    return this.wxtStorage.getValue();
  }

  setValue(value: VersionedStorage<TValue>): void {
    this.wxtStorage.setValue(value);
  }

  watch(callback: (value: VersionedStorage<TValue> | null) => void): () => void {
    return this.wxtStorage.watch(callback);
  }
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
  const adapter = new WxtStorageAdapter(key, options.fallback);

  return useReactiveStorage(adapter, {
    fallback: options.fallback,
    throttleDelay: 100,
    enableDebugLog: import.meta.env.DEV,
  });
}
