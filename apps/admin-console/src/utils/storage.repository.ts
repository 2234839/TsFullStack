import localforage from 'localforage';
import { reactive, ref } from 'vue';

export enum StorageType {
  API = 'api',
  INDEXED_DB = 'indexeddb',
  LOCAL_STORAGE = 'localstorage',
}

export interface StorageStats {
  readCount: number;
  writeCount: number;
  readTime: number;
  writeTime: number;
  lastError: string | null;
}

export interface StorageStrategy {
  type: StorageType;
  name: string;
  isAvailable: boolean;
  priority: number;
  stats: StorageStats;

  initialize(): Promise<boolean>;
  save(key: string, data: any): Promise<void>;
  load(key: string): Promise<any>;
  remove(key: string): Promise<void>;
  saveBatch(items: { key: string; data: any }[]): Promise<void>;
  loadBatch(keys: string[]): Promise<Record<string, any>>;
}

export class ApiStorageStrategy implements StorageStrategy {
  readonly type = StorageType.API;
  name = 'Remote API';
  isAvailable = false;
  priority = 1;
  stats = reactive<StorageStats>({
    readCount: 0,
    writeCount: 0,
    readTime: 0,
    writeTime: 0,
    lastError: null,
  });

  async initialize(): Promise<boolean> {
    try {
      // 测试API连通性
      const response = await fetch('/api/health');
      this.isAvailable = response.ok;
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      this.stats.lastError = `API初始化失败: ${error}`;
      return false;
    }
  }

  async save(key: string, data: any): Promise<void> {
    const start = performance.now();
    try {
      await fetch(`/api/data/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      this.stats.writeCount++;
      this.stats.writeTime += performance.now() - start;
    } catch (error) {
      this.stats.lastError = `保存失败: ${error}`;
      throw error;
    }
  }

  async load(key: string): Promise<any> {
    const start = performance.now();
    try {
      const response = await fetch(`/api/data/${encodeURIComponent(key)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      this.stats.readCount++;
      this.stats.readTime += performance.now() - start;
      return data;
    } catch (error) {
      this.stats.lastError = `加载失败: ${error}`;
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await fetch(`/api/data/${encodeURIComponent(key)}`, { method: 'DELETE' });
    } catch (error) {
      this.stats.lastError = `删除失败: ${error}`;
      throw error;
    }
  }

  async saveBatch(items: { key: string; data: any }[]): Promise<void> {
    const start = performance.now();
    try {
      await fetch('/api/data/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      });
      this.stats.writeCount += items.length;
      this.stats.writeTime += performance.now() - start;
    } catch (error) {
      this.stats.lastError = `批量保存失败: ${error}`;
      throw error;
    }
  }

  async loadBatch(keys: string[]): Promise<Record<string, any>> {
    const start = performance.now();
    try {
      const response = await fetch(`/api/data/batch?keys=${encodeURIComponent(keys.join(','))}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      this.stats.readCount += keys.length;
      this.stats.readTime += performance.now() - start;
      return data;
    } catch (error) {
      this.stats.lastError = `批量加载失败: ${error}`;
      throw error;
    }
  }
}

export class IndexedDBStorageStrategy implements StorageStrategy {
  readonly type = StorageType.INDEXED_DB;
  name = 'IndexedDB';
  isAvailable = false;
  priority = 2;
  stats = reactive<StorageStats>({
    readCount: 0,
    writeCount: 0,
    readTime: 0,
    writeTime: 0,
    lastError: null,
  });

  private store: LocalForage | null = null;

  async initialize(): Promise<boolean> {
    try {
      this.store = localforage.createInstance({
        name: 'app-storage',
        storeName: 'data',
        description: 'Application data storage',
      });

      // 测试IndexedDB可用性
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

  async save(key: string, data: any): Promise<void> {
    const start = performance.now();
    try {
      if (!this.store) throw new Error('IndexedDB未初始化');
      await this.store.setItem(
        key,
        /** 解决可能存在的克隆失败问题 DataCloneError: Failed to execute 'put' on 'IDBObjectStore': [object Array] could not be cloned.
         * https://github.com/localForage/localForage/issues/610
         */
        JSON.parse(JSON.stringify(data)),
      );
      this.stats.writeCount++;
      this.stats.writeTime += performance.now() - start;
    } catch (error) {
      this.stats.lastError = `保存失败: ${error}`;
      throw error;
    }
  }

  async load(key: string): Promise<any> {
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

  async remove(key: string): Promise<void> {
    try {
      if (!this.store) throw new Error('IndexedDB未初始化');
      await this.store.removeItem(key);
    } catch (error) {
      this.stats.lastError = `删除失败: ${error}`;
      throw error;
    }
  }

  async saveBatch(items: { key: string; data: any }[]): Promise<void> {
    const start = performance.now();
    try {
      if (!this.store) throw new Error('IndexedDB未初始化');

      const promises = items.map((item) => {
        return this.save(item.key, item.data); // Assuming save is
      });

      await Promise.all(promises);
      this.stats.writeCount += items.length;
      this.stats.writeTime += performance.now() - start;
    } catch (error) {
      this.stats.lastError = `批量保存失败: ${error}`;
      throw error;
    }
  }

  async loadBatch(keys: string[]): Promise<Record<string, any>> {
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
}

export class LocalStorageStrategy implements StorageStrategy {
  readonly type = StorageType.LOCAL_STORAGE;
  name = 'LocalStorage';
  isAvailable = false;
  priority = 3;
  stats = reactive<StorageStats>({
    readCount: 0,
    writeCount: 0,
    readTime: 0,
    writeTime: 0,
    lastError: null,
  });

  async initialize(): Promise<boolean> {
    try {
      // 测试localStorage可用性
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

  async save(key: string, data: any): Promise<void> {
    const start = performance.now();
    try {
      localStorage.setItem(key, JSON.stringify(data));
      this.stats.writeCount++;
      this.stats.writeTime += performance.now() - start;
    } catch (error) {
      this.stats.lastError = `保存失败: ${error}`;
      throw error;
    }
  }

  async load(key: string): Promise<any> {
    const start = performance.now();
    try {
      const data = localStorage.getItem(key);
      if (data === null) return null;

      const result = JSON.parse(data);
      this.stats.readCount++;
      this.stats.readTime += performance.now() - start;
      return result;
    } catch (error) {
      this.stats.lastError = `加载失败: ${error}`;
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      this.stats.lastError = `删除失败: ${error}`;
      throw error;
    }
  }

  async saveBatch(items: { key: string; data: any }[]): Promise<void> {
    const start = performance.now();
    try {
      items.forEach((item) => {
        localStorage.setItem(item.key, JSON.stringify(item.data));
      });
      this.stats.writeCount += items.length;
      this.stats.writeTime += performance.now() - start;
    } catch (error) {
      this.stats.lastError = `批量保存失败: ${error}`;
      throw error;
    }
  }

  async loadBatch(keys: string[]): Promise<Record<string, any>> {
    const start = performance.now();
    try {
      const result: Record<string, any> = {};
      keys.forEach((key) => {
        const data = localStorage.getItem(key);
        result[key] = data ? JSON.parse(data) : null;
      });
      this.stats.readCount += keys.length;
      this.stats.readTime += performance.now() - start;
      return result;
    } catch (error) {
      this.stats.lastError = `批量加载失败: ${error}`;
      throw error;
    }
  }
}

/** 支持渐进式本地存储，支持多种存储方式，支持自动升级存储  */
export class StorageRepository {
  private strategies: StorageStrategy[] = [];
  private initialized = false;

  // 配置选项
  private readPriority: StorageType[] = [];
  private writePriority: StorageType[] = [];
  private batchSize = 50;

  // 状态监控
  status = ref<'idle' | 'initializing' | 'ready' | 'error'>('idle');
  error = ref<string | null>(null);

  constructor() {
    // 默认策略
    this.addStrategy(new ApiStorageStrategy());
    this.addStrategy(new IndexedDBStorageStrategy());
    this.addStrategy(new LocalStorageStrategy());

    // 默认优先级：API > IndexedDB > LocalStorage
    this.setReadPriority([StorageType.API, StorageType.INDEXED_DB, StorageType.LOCAL_STORAGE]);
    this.setWritePriority([StorageType.API, StorageType.INDEXED_DB, StorageType.LOCAL_STORAGE]);
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    this.status.value = 'initializing';
    this.error.value = null;

    try {
      // 初始化所有存储策略
      const initPromises = this.strategies.map((strategy) => strategy.initialize());
      await Promise.all(initPromises);

      this.initialized = true;
      this.status.value = 'ready';
      return true;
    } catch (error) {
      this.initialized = false;
      this.status.value = 'error';
      this.error.value = `存储初始化失败: ${error}`;
      return false;
    }
  }

  addStrategy(strategy: StorageStrategy): void {
    this.strategies.push(strategy);
  }

  setPriority(priority: StorageType[]): void {
    this.readPriority = priority;
    this.writePriority = priority;
    this.sortStrategiesByPriority('read');
    this.sortStrategiesByPriority('write');
  }
  setReadPriority(priority: StorageType[]): void {
    this.readPriority = priority;
    this.sortStrategiesByPriority('read');
  }

  setWritePriority(priority: StorageType[]): void {
    this.writePriority = priority;
    this.sortStrategiesByPriority('write');
  }

  private sortStrategiesByPriority(mode: 'read' | 'write'): void {
    const priorityOrder = mode === 'read' ? this.readPriority : this.writePriority;

    this.strategies.sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a.type);
      const bIndex = priorityOrder.indexOf(b.type);

      if (aIndex === -1 && bIndex === -1) return a.priority - b.priority;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;

      return aIndex - bIndex;
    });
  }

  private getAvailableStrategies(mode: 'read' | 'write'): StorageStrategy[] {
    return this.strategies
      .filter((strategy) => strategy.isAvailable)
      .sort((a, b) => {
        const priorityOrder = mode === 'read' ? this.readPriority : this.writePriority;
        const aIndex = priorityOrder.indexOf(a.type);
        const bIndex = priorityOrder.indexOf(b.type);

        if (aIndex === bIndex) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;

        return aIndex - bIndex;
      });
  }

  async save(key: string, data: any): Promise<void> {
    if (!this.initialized) await this.initialize();

    const strategies = this.getAvailableStrategies('write');
    if (strategies.length === 0) throw new Error('没有可用的存储策略');

    let lastError: Error | null = null;

    for (const strategy of strategies) {
      try {
        await strategy.save(key, data);
        return; // 成功则返回
      } catch (error) {
        lastError = error as Error;
        console.warn(`[${strategy.name}] 保存失败, 尝试下个存储`, error);
      }
    }

    throw lastError || new Error('所有存储策略均失败');
  }

  async load(key: string): Promise<any> {
    if (!this.initialized) await this.initialize();

    const strategies = this.getAvailableStrategies('read');
    if (strategies.length === 0) throw new Error('没有可用的存储策略');

    let lastError: Error | null = null;

    for (const strategy of strategies) {
      try {
        const data = await strategy.load(key);
        // 如果找到有效数据，同时写入到更高优先级的存储中
        if (data !== null && data !== undefined) {
          await this.writeToHigherPriority(key, data, strategy);
          return data;
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`[${strategy.name}] 加载失败, 尝试下个存储`, error);
      }
    }

    throw lastError || new Error('数据未找到且所有存储策略均失败');
  }

  private async writeToHigherPriority(
    key: string,
    data: any,
    currentStrategy: StorageStrategy,
  ): Promise<void> {
    try {
      const higherPriority = this.getAvailableStrategies('write').filter(
        (strategy) =>
          this.writePriority.indexOf(strategy.type) <
          this.writePriority.indexOf(currentStrategy.type),
      );

      if (higherPriority.length === 0) return;

      const promises = higherPriority.map((strategy) =>
        strategy.save(key, data).catch(console.error),
      );

      await Promise.all(promises);
    } catch (error) {
      console.error('回写数据到更高优先级存储失败', error);
    }
  }

  async remove(key: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    const strategies = this.getAvailableStrategies('write');
    if (strategies.length === 0) throw new Error('没有可用的存储策略');

    const promises = strategies.map((strategy) => strategy.remove(key).catch(console.error));

    await Promise.all(promises);
  }

  async saveBatch(items: { key: string; data: any }[]): Promise<void> {
    if (!this.initialized) await this.initialize();

    const strategies = this.getAvailableStrategies('write');
    if (strategies.length === 0) throw new Error('没有可用的存储策略');

    // 分批处理防止内存溢出
    const chunks = this.chunkArray(items, this.batchSize);
    for (const strategy of strategies) {
      try {
        for (const chunk of chunks) {
          await strategy.saveBatch(chunk);
        }
        return; // 成功则返回
      } catch (error) {
        console.warn(`[${strategy.name}] 批量保存失败, 尝试下个存储`, error);
      }
    }

    throw new Error('所有存储策略批量保存均失败');
  }

  async loadBatch(keys: string[]): Promise<Record<string, any>> {
    if (!this.initialized) await this.initialize();

    const strategies = this.getAvailableStrategies('read');
    if (strategies.length === 0) throw new Error('没有可用的存储策略');

    // 分批处理防止内存溢出
    const chunks = this.chunkArray(keys, this.batchSize);
    let result: Record<string, any> = {};

    for (const strategy of strategies) {
      try {
        for (const chunk of chunks) {
          const chunkResult = await strategy.loadBatch(chunk);
          result = { ...result, ...chunkResult };
        }

        // 将找到的数据回写到更高优先级的存储
        await this.writeBatchToHigherPriority(result, strategy);

        return result;
      } catch (error) {
        console.warn(`[${strategy.name}] 批量加载失败, 尝试下个存储`, error);
      }
    }

    throw new Error('数据未找到且所有存储策略批量加载均失败');
  }

  private async writeBatchToHigherPriority(
    data: Record<string, any>,
    currentStrategy: StorageStrategy,
  ): Promise<void> {
    try {
      const higherPriority = this.getAvailableStrategies('write').filter(
        (strategy) =>
          this.writePriority.indexOf(strategy.type) <
          this.writePriority.indexOf(currentStrategy.type),
      );

      if (higherPriority.length === 0) return;

      const items = Object.entries(data)
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => ({ key, data: value }));

      if (items.length === 0) return;

      const promises = higherPriority.map((strategy) =>
        strategy.saveBatch(items).catch(console.error),
      );

      await Promise.all(promises);
    } catch (error) {
      console.error('批量回写数据到更高优先级存储失败', error);
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // 迁移工具：从旧存储迁移数据到新存储
  async migrateData(fromStrategy: StorageStrategy, toStrategy: StorageStrategy): Promise<void> {
    if (!fromStrategy.isAvailable) throw new Error('源存储不可用');
    if (!toStrategy.isAvailable) throw new Error('目标存储不可用');

    // 注意：此方法为简化示例，实际迁移需要更复杂的逻辑
    console.log(`开始从 ${fromStrategy.name} 迁移数据到 ${toStrategy.name}`);

    // 获取所有键名（实际应用中需要更完善的方法）
    const keys = await this.getAllKeys(fromStrategy);

    // 分批迁移
    const chunks = this.chunkArray(keys, this.batchSize);

    for (const chunk of chunks) {
      const data = await fromStrategy.loadBatch(chunk);
      await toStrategy.saveBatch(
        Object.entries(data).map(([key, value]) => ({ key, data: value })),
      );
    }

    console.log(`迁移完成: ${keys.length} 条数据已迁移`);
  }

  // 获取所有键名（简化版）
  private async getAllKeys(_strategy: StorageStrategy): Promise<string[]> {
    // 实际应用中需要根据存储类型实现
    return []; // 简化实现
  }

  // 监控与诊断
  getStorageStats(): Record<string, StorageStats> {
    return this.strategies.reduce((result, strategy) => {
      result[strategy.type] = { ...strategy.stats };
      return result;
    }, {} as Record<string, StorageStats>);
  }

  getStorageStatus(): Record<string, boolean> {
    return this.strategies.reduce((result, strategy) => {
      result[strategy.name] = strategy.isAvailable;
      return result;
    }, {} as Record<string, boolean>);
  }
}
