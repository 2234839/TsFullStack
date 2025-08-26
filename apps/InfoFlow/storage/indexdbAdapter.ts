import Dexie, { Table } from 'dexie';
import { defineProxyService } from '@webext-core/proxy-service';
import type { StorageAdapter, VersionedStorage } from './storageAdapter';

interface ConfigItem {
  key: string;
  data: any;
}

class ConfigDatabase extends Dexie {
  configs!: Table<ConfigItem, string>;

  constructor() {
    super('infoFlowConfigDB');
    
    this.version(1).stores({
      configs: 'key, data'
    });
  }
}

const db = new ConfigDatabase();

function createConfigsService() {
  return {
    async getAll(options?: { limit?: number; offset?: number }) {
      let query = db.configs.toCollection();
      
      if (options?.limit !== undefined) {
        const offset = options.offset || 0;
        query = query.offset(offset).limit(options.limit);
      }
      
      return await query.toArray();
    },
    async upsert(info: ConfigItem) {
      await db.configs.put(info);
    },
    async getItem(key: string) {
      const result = await db.configs.get(key);
      return result?.data;
    },
    async setItem(key: string, data: any) {
      await db.configs.put({ key, data });
    },
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
