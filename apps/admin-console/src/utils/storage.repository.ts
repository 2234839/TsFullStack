import localforage from 'localforage';
import { reactive, ref } from 'vue';
import superjson from 'superjson';

export interface StorageStats {
  readCount: number;
  writeCount: number;
  readTime: number;
  writeTime: number;
  lastError: string | null;
}

export interface StorageOptions {
  /**
   * Serializer/deserializer functions
   * @default superjson
   */
  serializer?: {
    serialize: (data: any) => string;
    deserialize: (data: string) => any;
  };
  /**
   * Enable bucket support
   * @default false
   */
  bucket?:
    | boolean
    | {
        /**
         * Default bucket name
         * @default 'default'
         */
        defaultBucket?: string;
        /**
         * Bucket separator
         * @default '::'
         */
        separator?: string;
      };
}

export abstract class StorageStrategy {
  abstract name: string;
  isAvailable = false;
  priority = 0;
  stats = reactive<StorageStats>({
    readCount: 0,
    writeCount: 0,
    readTime: 0,
    writeTime: 0,
    lastError: null,
  });

  protected readonly serializer: {
    serialize: (data: any) => string;
    deserialize: (data: string) => any;
  };
  protected bucketConfig: {
    enabled: boolean;
    defaultBucket: string;
    separator: string;
  };

  constructor(public options: StorageOptions = {}) {
    // Initialize serializer
    this.serializer = options.serializer || {
      serialize: superjson.stringify,
      deserialize: superjson.parse,
    };

    // Initialize bucket configuration
    this.bucketConfig = {
      enabled: !!options.bucket,
      defaultBucket:
        typeof options.bucket === 'object' ? options.bucket.defaultBucket || 'default' : 'default',
      separator: typeof options.bucket === 'object' ? options.bucket.separator || '::' : '::',
    };
  }

  abstract initialize(): Promise<boolean>;
  protected abstract rawSave(key: string, data: any): Promise<void>;
  protected abstract rawLoad(key: string): Promise<any>;
  protected abstract rawRemove(key: string): Promise<void>;
  protected abstract rawSaveBatch(items: { key: string; data: any }[]): Promise<void>;
  protected abstract rawLoadBatch(keys: string[]): Promise<Record<string, any>>;

  setBucket(bucket?: string): void {
    this.bucketConfig = {
      enabled: !!bucket,
      defaultBucket: 'default',
      separator: '::',
    };
  }
  protected withBucket(key: string, bucket?: string): string {
    if (!this.bucketConfig.enabled) return key;
    return bucket
      ? `${bucket}${this.bucketConfig.separator}${key}`
      : `${this.bucketConfig.defaultBucket}${this.bucketConfig.separator}${key}`;
  }

  protected withoutBucket(fullKey: string): { key: string; bucket: string | null } {
    if (!this.bucketConfig.enabled) return { key: fullKey, bucket: null };

    const separatorIndex = fullKey.indexOf(this.bucketConfig.separator);
    if (separatorIndex === -1) {
      return { key: fullKey, bucket: this.bucketConfig.defaultBucket };
    }

    return {
      bucket: fullKey.substring(0, separatorIndex),
      key: fullKey.substring(separatorIndex + this.bucketConfig.separator.length),
    };
  }

  async save(key: string, data: any, bucket?: string): Promise<void> {
    const fullKey = this.withBucket(key, bucket);
    const serialized = this.serializer.serialize(data);
    return this.rawSave(fullKey, serialized);
  }

  async load(key: string, bucket?: string): Promise<any> {
    const fullKey = this.withBucket(key, bucket);
    const serialized = await this.rawLoad(fullKey);
    return serialized ? this.serializer.deserialize(serialized) : null;
  }

  async remove(key: string, bucket?: string): Promise<void> {
    const fullKey = this.withBucket(key, bucket);
    return this.rawRemove(fullKey);
  }

  async saveBatch(items: { key: string; data: any; bucket?: string }[]): Promise<void> {
    const serializedItems = items.map((item) => ({
      key: this.withBucket(item.key, item.bucket),
      data: this.serializer.serialize(item.data),
    }));
    return this.rawSaveBatch(serializedItems);
  }

  async loadBatch(keys: { key: string; bucket?: string }[]): Promise<Record<string, any>> {
    const fullKeys = keys.map((k) => this.withBucket(k.key, k.bucket));
    const serializedData = await this.rawLoadBatch(fullKeys);

    const result: Record<string, any> = {};
    for (const [fullKey, value] of Object.entries(serializedData)) {
      const { key } = this.withoutBucket(fullKey);
      result[key] = value ? this.serializer.deserialize(value) : null;
    }

    return result;
  }

  async getBucketKeys(bucket: string): Promise<string[]> {
    if (!this.bucketConfig.enabled) {
      throw new Error('Bucket support is not enabled');
    }

    const prefix = `${bucket}${this.bucketConfig.separator}`;
    const allKeys = await this.getAllKeys();
    return allKeys.filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
  }

  async clearBucket(bucket: string): Promise<void> {
    if (!this.bucketConfig.enabled) {
      throw new Error('Bucket support is not enabled');
    }

    const keys = await this.getBucketKeys(bucket);
    await this.rawRemoveBatch(keys.map((key) => this.withBucket(key, bucket)));
  }

  protected abstract getAllKeys(): Promise<string[]>;
  protected abstract rawRemoveBatch(keys: string[]): Promise<void>;
}

export class ApiStorageStrategy extends StorageStrategy {
  name = 'Remote API';
  priority = 1;

  constructor(options?: StorageOptions & { baseUrl?: string }) {
    super(options);
    this.baseUrl = options?.baseUrl || '/api';
  }

  private baseUrl: string;

  async initialize(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      this.isAvailable = response.ok;
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      this.stats.lastError = `API初始化失败: ${error}`;
      return false;
    }
  }

  protected async rawSave(key: string, data: any): Promise<void> {
    const start = performance.now();
    try {
      await fetch(`${this.baseUrl}/data/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      this.stats.writeCount++;
      this.stats.writeTime += performance.now() - start;
    } catch (error) {
      this.stats.lastError = `保存失败: ${error}`;
      throw error;
    }
  }

  protected async rawLoad(key: string): Promise<any> {
    const start = performance.now();
    try {
      const response = await fetch(`${this.baseUrl}/data/${encodeURIComponent(key)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const { data } = await response.json();
      this.stats.readCount++;
      this.stats.readTime += performance.now() - start;
      return data;
    } catch (error) {
      this.stats.lastError = `加载失败: ${error}`;
      throw error;
    }
  }

  protected async rawRemove(key: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/data/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      this.stats.lastError = `删除失败: ${error}`;
      throw error;
    }
  }

  protected async rawSaveBatch(items: { key: string; data: any }[]): Promise<void> {
    const start = performance.now();
    try {
      await fetch(`${this.baseUrl}/data/batch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      this.stats.writeCount += items.length;
      this.stats.writeTime += performance.now() - start;
    } catch (error) {
      this.stats.lastError = `批量保存失败: ${error}`;
      throw error;
    }
  }

  protected async rawLoadBatch(keys: string[]): Promise<Record<string, any>> {
    const start = performance.now();
    try {
      const response = await fetch(
        `${this.baseUrl}/data/batch?keys=${encodeURIComponent(keys.join(','))}`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const { data } = await response.json();
      this.stats.readCount += keys.length;
      this.stats.readTime += performance.now() - start;
      return data;
    } catch (error) {
      this.stats.lastError = `批量加载失败: ${error}`;
      throw error;
    }
  }

  protected async getAllKeys(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/data/keys`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { keys } = await response.json();
      return keys;
    } catch (error) {
      this.stats.lastError = `获取所有键失败: ${error}`;
      throw error;
    }
  }

  protected async rawRemoveBatch(keys: string[]): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/data/batch`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      });
    } catch (error) {
      this.stats.lastError = `批量删除失败: ${error}`;
      throw error;
    }
  }
}

export class IndexedDBStorageStrategy extends StorageStrategy {
  name = 'IndexedDB';
  priority = 2;

  private store: LocalForage | null = null;

  constructor(options?: StorageOptions & { dbName?: string; storeName?: string }) {
    super(options);
    this.dbName = options?.dbName || 'app-storage';
    this.storeName = options?.storeName || 'data';
  }

  private dbName: string;
  private storeName: string;

  async initialize(): Promise<boolean> {
    try {
      this.store = localforage.createInstance({
        name: this.dbName,
        storeName: this.storeName,
        description: 'Application data storage',
      });

      await this.store.setItem('__test__', 'test');
      await this.store.removeItem('__test__');
      this.isAvailable = true;
      return true;
    } catch (error) {
      this.isAvailable = false;
      this.stats.lastError = `IndexedDB初始化失败: ${error}`;
      return false;
    }
  }

  protected async rawSave(key: string, data: any): Promise<void> {
    const start = performance.now();
    try {
      if (!this.store) throw new Error('IndexedDB未初始化');
      await this.store.setItem(key, data);
      this.stats.writeCount++;
      this.stats.writeTime += performance.now() - start;
    } catch (error) {
      this.stats.lastError = `保存失败: ${error}`;
      throw error;
    }
  }

  protected async rawLoad(key: string): Promise<any> {
    const start = performance.now();
    try {
      if (!this.store) throw new Error('IndexedDB未初始化');
      const data = await this.store.getItem(key);
      this.stats.readCount++;
      this.stats.readTime += performance.now() - start;
      return data;
    } catch (error) {
      this.stats.lastError = `加载失败: ${error}`;
      throw error;
    }
  }

  protected async rawRemove(key: string): Promise<void> {
    try {
      if (!this.store) throw new Error('IndexedDB未初始化');
      await this.store.removeItem(key);
    } catch (error) {
      this.stats.lastError = `删除失败: ${error}`;
      throw error;
    }
  }

  protected async rawSaveBatch(items: { key: string; data: any }[]): Promise<void> {
    const start = performance.now();
    try {
      if (!this.store) throw new Error('IndexedDB未初始化');

      const promises = items.map((item) => this.store!.setItem(item.key, item.data));

      await Promise.all(promises);
      this.stats.writeCount += items.length;
      this.stats.writeTime += performance.now() - start;
    } catch (error) {
      this.stats.lastError = `批量保存失败: ${error}`;
      throw error;
    }
  }

  protected async rawLoadBatch(keys: string[]): Promise<Record<string, any>> {
    const start = performance.now();
    try {
      if (!this.store) throw new Error('IndexedDB未初始化');

      const result: Record<string, any> = {};
      const promises = keys.map(async (key) => {
        result[key] = await this.store!.getItem(key);
      });

      await Promise.all(promises);
      this.stats.readCount += keys.length;
      this.stats.readTime += performance.now() - start;
      return result;
    } catch (error) {
      this.stats.lastError = `批量加载失败: ${error}`;
      throw error;
    }
  }

  protected async getAllKeys(): Promise<string[]> {
    try {
      if (!this.store) throw new Error('IndexedDB未初始化');
      return await this.store.keys();
    } catch (error) {
      this.stats.lastError = `获取所有键失败: ${error}`;
      throw error;
    }
  }

  protected async rawRemoveBatch(keys: string[]): Promise<void> {
    try {
      if (!this.store) throw new Error('IndexedDB未初始化');

      const promises = keys.map((key) => this.store!.removeItem(key));

      await Promise.all(promises);
    } catch (error) {
      this.stats.lastError = `批量删除失败: ${error}`;
      throw error;
    }
  }
}

export class LocalStorageStrategy extends StorageStrategy {
  name = 'LocalStorage';
  priority = 3;

  async initialize(): Promise<boolean> {
    try {
      const testKey = '__test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      this.isAvailable = true;
      return true;
    } catch (error) {
      this.isAvailable = false;
      this.stats.lastError = `LocalStorage初始化失败: ${error}`;
      return false;
    }
  }

  protected async rawSave(key: string, data: any): Promise<void> {
    const start = performance.now();
    try {
      localStorage.setItem(key, data);
      this.stats.writeCount++;
      this.stats.writeTime += performance.now() - start;
    } catch (error) {
      this.stats.lastError = `保存失败: ${error}`;
      throw error;
    }
  }

  protected async rawLoad(key: string): Promise<any> {
    const start = performance.now();
    try {
      const data = localStorage.getItem(key);
      this.stats.readCount++;
      this.stats.readTime += performance.now() - start;
      return data;
    } catch (error) {
      this.stats.lastError = `加载失败: ${error}`;
      throw error;
    }
  }

  protected async rawRemove(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      this.stats.lastError = `删除失败: ${error}`;
      throw error;
    }
  }

  protected async rawSaveBatch(items: { key: string; data: any }[]): Promise<void> {
    const start = performance.now();
    try {
      items.forEach((item) => {
        localStorage.setItem(item.key, item.data);
      });
      this.stats.writeCount += items.length;
      this.stats.writeTime += performance.now() - start;
    } catch (error) {
      this.stats.lastError = `批量保存失败: ${error}`;
      throw error;
    }
  }

  protected async rawLoadBatch(keys: string[]): Promise<Record<string, any>> {
    const start = performance.now();
    try {
      const result: Record<string, any> = {};
      keys.forEach((key) => {
        result[key] = localStorage.getItem(key);
      });
      this.stats.readCount += keys.length;
      this.stats.readTime += performance.now() - start;
      return result;
    } catch (error) {
      this.stats.lastError = `批量加载失败: ${error}`;
      throw error;
    }
  }

  protected async getAllKeys(): Promise<string[]> {
    try {
      return Object.keys(localStorage);
    } catch (error) {
      this.stats.lastError = `获取所有键失败: ${error}`;
      throw error;
    }
  }

  protected async rawRemoveBatch(keys: string[]): Promise<void> {
    try {
      keys.forEach((key) => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      this.stats.lastError = `批量删除失败: ${error}`;
      throw error;
    }
  }
}

/**
 * strategies : 默认可以设置为 IndexedDBStorageStrategy LocalStorageStrategy ApiStorageStrategy
 */
export class StorageRepository {
  private strategies: StorageStrategy[] = [];
  private initialized = false;
  private defaultBatchSize = 50;

  // 状态监控
  status = ref<'idle' | 'initializing' | 'ready' | 'error'>('idle');
  error = ref<string | null>(null);

  constructor(public options: { bucket?: string; strategies: StorageStrategy[] }) {
    if (options.strategies.length > 0) {
      options.strategies.forEach((s) => {
        s.setBucket(options.bucket);
        this.strategies.push(s);
      });
    }
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    this.status.value = 'initializing';
    this.error.value = null;

    try {
      await Promise.all(this.strategies.map((s) => s.initialize()));

      // 过滤掉不可用的策略
      this.strategies = this.strategies.filter((s) => s.isAvailable);

      this.initialized = true;
      this.status.value = 'ready';
      return true;
    } catch (error) {
      this.status.value = 'error';
      this.error.value = `初始化失败: ${error instanceof Error ? error.message : String(error)}`;
      return false;
    }
  }

  private getAvailableStrategies(): StorageStrategy[] {
    return this.strategies;
  }

  async save(key: string, data: any): Promise<void> {
    if (!this.initialized) await this.initialize();

    const strategies = this.getAvailableStrategies();
    if (strategies.length === 0) {
      throw new Error('没有可用的存储策略');
    }

    let lastError: Error | null = null;

    for (const strategy of strategies) {
      try {
        await strategy.save(key, data, this.options.bucket);
        return;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[${strategy.name}] 存储失败`, error);
      }
    }

    throw lastError || new Error('所有存储策略均失败');
  }

  async load(key: string): Promise<any> {
    if (!this.initialized) await this.initialize();

    const strategies = this.getAvailableStrategies();
    if (strategies.length === 0) {
      throw new Error('没有可用的存储策略');
    }

    let lastError: Error | null = null;

    for (const strategy of strategies) {
      try {
        const data = await strategy.load(key, this.options.bucket);
        if (data !== null && data !== undefined) {
          // 将数据回写到更高优先级的存储
          await this.writeToHigherPriority(key, data, strategy);
          return data;
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`[${strategy.name}] 读取失败`, error);
      }
    }

    throw lastError || new Error('数据未找到');
  }

  private async writeToHigherPriority(
    key: string,
    data: any,
    currentStrategy: StorageStrategy,
  ): Promise<void> {
    const currentIndex = this.strategies.indexOf(currentStrategy);
    if (currentIndex <= 0) return; // 已经是最高优先级

    const higherStrategies = this.strategies.filter(
      (s) => s.isAvailable && this.strategies.indexOf(s) < currentIndex,
    );

    if (higherStrategies.length === 0) return;

    await Promise.all(
      higherStrategies.map((s) =>
        s
          .save(key, data, this.options.bucket)
          .catch((e) => console.warn(`回写到 ${s.name} 失败`, e)),
      ),
    );
  }

  async remove(key: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    const strategies = this.getAvailableStrategies();
    if (strategies.length === 0) {
      throw new Error('没有可用的存储策略');
    }

    await Promise.all(
      strategies.map((s) =>
        s.remove(key, this.options.bucket).catch((e) => console.warn(`[${s.name}] 删除失败`, e)),
      ),
    );
  }

  async saveBatch(
    items: { key: string; data: any }[],
    batchSize = this.defaultBatchSize,
  ): Promise<void> {
    if (!this.initialized) await this.initialize();

    const strategies = this.getAvailableStrategies();
    if (strategies.length === 0) {
      throw new Error('没有可用的存储策略');
    }

    // 分批处理
    const chunks = this.chunkArray(items, batchSize);
    let lastError: Error | null = null;

    for (const strategy of strategies) {
      try {
        for (const chunk of chunks) {
          await strategy.saveBatch(chunk.map((el) => ({ ...el, bucket: this.options.bucket })));
        }
        return;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[${strategy.name}] 批量存储失败`, error);
      }
    }

    throw lastError || new Error('所有存储策略批量存储均失败');
  }

  async loadBatch(keys: string[], batchSize = this.defaultBatchSize): Promise<Record<string, any>> {
    if (!this.initialized) await this.initialize();

    const strategies = this.getAvailableStrategies();
    if (strategies.length === 0) {
      throw new Error('没有可用的存储策略');
    }

    // 分批处理
    const chunks = this.chunkArray(keys, batchSize);
    let result: Record<string, any> = {};
    let lastError: Error | null = null;

    for (const strategy of strategies) {
      try {
        for (const chunk of chunks) {
          const chunkResult = await strategy.loadBatch(
            chunk.map((key) => ({ key, bucket: this.options.bucket })),
          );
          Object.assign(result, chunkResult);
        }

        // 将找到的数据回写到更高优先级的存储
        await this.writeBatchToHigherPriority(result, strategy);

        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[${strategy.name}] 批量读取失败`, error);
      }
    }

    throw lastError || new Error('数据未找到且所有存储策略批量读取均失败');
  }

  private async writeBatchToHigherPriority(
    data: Record<string, any>,
    currentStrategy: StorageStrategy,
  ): Promise<void> {
    const currentIndex = this.strategies.indexOf(currentStrategy);
    if (currentIndex <= 0) return;

    const higherStrategies = this.strategies.filter(
      (s) => s.isAvailable && this.strategies.indexOf(s) < currentIndex,
    );

    if (higherStrategies.length === 0) return;

    const items = Object.entries(data)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => ({ key, data: value }));

    if (items.length === 0) return;

    await Promise.all(
      higherStrategies.map((s) =>
        s.saveBatch(items).catch((e) => console.warn(`批量回写到 ${s.name} 失败`, e)),
      ),
    );
  }

  async getBucketKeys(bucket: string): Promise<string[]> {
    if (!this.initialized) await this.initialize();

    const strategies = this.getAvailableStrategies();
    if (strategies.length === 0) {
      throw new Error('没有可用的存储策略');
    }

    // 使用第一个支持bucket的策略
    const strategy = strategies.find((s) => s.options.bucket !== undefined);

    if (!strategy) {
      throw new Error('没有支持bucket的存储策略');
    }

    return strategy.getBucketKeys(bucket);
  }

  async clearBucket(bucket: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    const strategies = this.getAvailableStrategies();
    if (strategies.length === 0) {
      throw new Error('没有可用的存储策略');
    }

    // 使用第一个支持bucket的策略
    const strategy = strategies.find((s) => s.options.bucket !== undefined);

    if (!strategy) {
      throw new Error('没有支持bucket的存储策略');
    }

    await strategy.clearBucket(bucket);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
