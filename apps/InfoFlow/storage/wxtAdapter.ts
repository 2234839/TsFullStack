import { storage } from '#imports';
import type { StorageAdapter, VersionedStorage } from './storageAdapter';

/**
 * Options for defining a WXT storage item
 */
export type WxtStorageItemOptions<Tvalue> = Parameters<typeof storage.defineItem<Tvalue>>[1];

/**
 * Key type for WXT storage items
 */
export type WxtStorageKey = Parameters<typeof storage.defineItem>[0];

/**
 * WXT storage adapter implementation
 */
export class WxtStorageAdapter<TValue> implements StorageAdapter<TValue> {
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
