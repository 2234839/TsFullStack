import { getConfigsService } from '../entrypoints/background/service/configService';
import type { StorageAdapter, VersionedStorage } from './storageAdapter';

/**
 * 通过 Indexdb 存储数据，使用轮询实现数据变更 watch
 */
export class InexdbStorageAdapter<TValue> implements StorageAdapter<TValue> {
  private configsService = getConfigsService();

  constructor(private key: string, private fallback: TValue) {}

  async getValue(): Promise<VersionedStorage<TValue> | null> {
    const value = await this.configsService.getItem(this.key);
    return (
      value?.data ?? {
        value: this.fallback,
        version: 0,
        writerId: '',
      }
    );
  }

  setValue(value: VersionedStorage<TValue>): void {
    this.configsService.setItem(this.key, value);
  }

  watch(callback: (value: VersionedStorage<TValue> | null) => void): () => void {
    const id = setInterval(async () => {
      const v = await this.configsService.getItem(this.key);
      if (v?.data) {
        callback(v.data);
      }
    }, 900);
    return () => {
      clearInterval(id);
    };
  }
}
