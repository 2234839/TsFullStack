import type { WxtStorageItemOptions } from 'wxt/utils/storage';
import { InexdbStorageAdapter } from './indexdbAdapter';
import { useReactiveStorage } from './storageAdapter';
import { WxtStorageAdapter, type WxtStorageKey } from './wxtAdapter';

/**
 * 创建一个响应式的浏览器扩展存储工具，能够在多个实例（不同标签页、后台脚本、弹出窗口等）之间同步数据
 * ，具有近似实时更新（100ms 节流）。
 *
 * 此函数提供一个 Vue 响应式 ref，自动在所有扩展上下文中同步更改，
 * 使用版本控制来防止冲突并确保数据一致性。
 *
 * 数据存储在本地，并在移除扩展程序时清除。存储空间限制为 10 MB（在 Chrome 113 及更早版本中为 5 MB）:https://developer.chrome.com/docs/extensions/reference/api/storage?hl=zh-cn
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

export function useIdbStorage<TValue>(
  key: string,
  options: { fallback: TValue | (undefined & TValue) },
) {
  const adapter = new InexdbStorageAdapter(key, options.fallback);

  return useReactiveStorage(adapter, {
    fallback: options.fallback,
    throttleDelay: 100,
    enableDebugLog: import.meta.env.DEV,
  });
}
