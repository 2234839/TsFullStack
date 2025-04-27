import { ref, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { storage } from '#imports';
import SuperJSON from 'superjson';

export function useStorage<T>(
  storeKey: `local:${string}` | `session:${string}` | `sync:${string}` | `managed:${string}`,
  initValue: () => T,
) {
  const data = ref<T>(initValue());

  let resolve: (data: any) => void;
  const loadingPromise = new Promise<void>((r) => {
    resolve = r;
  });
  storage.getItem(storeKey).then((storedValue) => {
    try {
      data.value = storedValue ? SuperJSON.parse(storedValue as string) : initValue();
      resolve(1);
    } catch (e) {}
  });

  const saveConfig = useDebounceFn(() => {
    try {
      storage.setItem(storeKey, SuperJSON.stringify(data.value));
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  }, 300);

  watch(data, saveConfig, { deep: true });

  return {
    data,
    loadingPromise,
    saveConfig,
  };
}
