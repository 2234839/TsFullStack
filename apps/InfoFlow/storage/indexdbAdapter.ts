import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { defineProxyService } from '@webext-core/proxy-service';
import type { StorageAdapter, VersionedStorage } from './storageAdapter';
interface ExtensionDatabaseSchema extends DBSchema {
  configs: {
    key: string;
    value: { data: any; key: string };
  };
}

export type ExtensionDatabase = IDBPDatabase<ExtensionDatabaseSchema>;

export function openExtensionDatabase(): Promise<ExtensionDatabase> {
  return openDB<ExtensionDatabaseSchema>('infoFlow', 3, {
    upgrade(database) {
      database.createObjectStore('configs', {
        /** 这里定义的key是插入和查询都需要的 */ keyPath: 'key',
      });
    },
  });
}

function createConfigsService(_db: Promise<ExtensionDatabase>) {
  return {
    async getAll() {
      const db = await _db;
      return await db.getAll('configs');
    },
    async upsert(info: ExtensionDatabaseSchema['configs']['value']) {
      const db = await _db;
      await db.put('configs', info);
    },
    async getItem(key: string) {
      const db = await _db;
      return await db.get('configs', key);
    },
    async setItem(key: string, data: any) {
      const db = await _db;
      return await db.put('configs', { key, data });
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
