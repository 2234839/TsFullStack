import { storage } from '#imports';

export const infoFlowConfig = useWxtStorage(
  storage.defineItem('local:infoFlowConfig', {
    fallback: {
      test: 33,
    },
    version: 1,
  }),
);

export function useWxtStorage<T>(wxtStorage: globalThis.WxtStorageItem<T, {}>) {
  const storageRef = ref<T | undefined>();
  let isUpdatingFromStorage = false;

  const unWatch = wxtStorage.watch((v) => {
    isUpdatingFromStorage = true;
    storageRef.value = v;
    console.log('watch', v);
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
        wxtStorage.setValue(v);
        console.log('save', v);
      } else {
        wxtStorage.removeValue();
      }
    },
    { deep: true },
  );

  return storageRef;
}
