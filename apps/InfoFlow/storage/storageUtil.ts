import { storage } from '#imports';
import { ref, onUnmounted, watch } from 'vue';
type WxtStorageItemOptions<Tvalue> = Parameters<typeof storage.defineItem<Tvalue>>[1];
type WxtStorageKey = Parameters<typeof storage.defineItem>[0];

/** 设置一个响应式的插件存储数据 */
export function useWxtStorage<TValue>(
  key: WxtStorageKey,
  options: WxtStorageItemOptions<TValue> &
    /** 约束 fallback 必传，这样可以避免 storageRef 为 undefined 的情况出现（除非fallback本身就支持 undefined） */
    Required<Pick<WxtStorageItemOptions<TValue>, 'fallback'>>,
) {
  const wxtStorage = storage.defineItem(key, options);
  const storageRef = ref<TValue>(options.fallback);
  let isUpdatingFromStorage = false;

  const unWatch = wxtStorage.watch((v) => {
    isUpdatingFromStorage = true;
    storageRef.value = v;
    // console.log('watch', v);
    setTimeout(() => {
      isUpdatingFromStorage = false;
    }, 0);
  });
  onUnmounted(unWatch);

  wxtStorage.getValue().then((v) => {
    isUpdatingFromStorage = true;
    storageRef.value = v;
    setTimeout(() => {
      isUpdatingFromStorage = false;
    }, 0);
  });

  watch(
    storageRef,
    (v) => {
      if (isUpdatingFromStorage) return;

      if (v !== undefined) {
        wxtStorage.setValue(storageRef.value);
        // console.log('save', storageRef.value);
      } else {
        wxtStorage.removeValue();
      }
    },
    { deep: true },
  );

  return storageRef;
}
