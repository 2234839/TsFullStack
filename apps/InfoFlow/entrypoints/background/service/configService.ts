import { defineProxyService } from '@webext-core/proxy-service';
import { getDbService } from './dbService';
import type { StorageAdapter, VersionedStorage } from '@/storage/storageAdapter';

// 配置服务 - 基于统一的数据库服务
function createConfigsService() {
  return {
    async getAll(options?: { limit?: number; offset?: number }) {
      const dbService = getDbService();
      return await dbService.configs.getAll(options);
    },
    
    async upsert(info: { key: string; data: any }) {
      const dbService = getDbService();
      await dbService.configs.upsert(info);
    },
    
    async getItem(key: string) {
      const dbService = getDbService();
      return await dbService.configs.getItem(key);
    },
    
    async setItem(key: string, data: any) {
      const dbService = getDbService();
      await dbService.configs.setItem(key, data);
    },
    
    async deleteItem(key: string) {
      const dbService = getDbService();
      await dbService.configs.deleteItem(key);
    },
    
    async reset() {
      const dbService = getDbService();
      await dbService.reset();
    }
  };
}

export const [registerConfigsService, getConfigsService] = defineProxyService(
  'configs-service',
  createConfigsService,
);

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