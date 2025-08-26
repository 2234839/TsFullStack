import Dexie, { Table } from 'dexie';

// 定义配置项类型
export interface ConfigItem {
  key: string;
  data: any;
}

// 创建 Dexie 数据库
class ConfigDatabase extends Dexie {
  configs!: Table<ConfigItem, string>;

  constructor() {
    super('infoFlowConfigDB');
    
    // 定义数据库架构 - Dexie 会自动处理版本和索引
    this.version(1).stores({
      configs: 'key, data'
    });
  }
}

// 创建数据库实例
const db = new ConfigDatabase();

// 配置服务
export class ConfigService {
  // 获取所有配置
  async getAll(options?: { limit?: number; offset?: number }): Promise<ConfigItem[]> {
    let query = db.configs.toCollection();
    
    if (options?.limit !== undefined) {
      const offset = options.offset || 0;
      query = query.offset(offset).limit(options.limit);
    }
    
    return await query.toArray();
  }

  // 更新或插入配置
  async upsert(info: ConfigItem): Promise<void> {
    await db.configs.put(info);
  }

  // 获取配置项
  async getItem(key: string): Promise<any> {
    const result = await db.configs.get(key);
    return result?.data;
  }

  // 设置配置项
  async setItem(key: string, data: any): Promise<void> {
    await db.configs.put({ key, data });
  }

  // 删除配置项
  async deleteItem(key: string): Promise<void> {
    await db.configs.delete(key);
  }

  // 重置数据库
  async reset(): Promise<void> {
    await db.delete();
    await db.open();
  }
}

// 创建服务实例
export const configService = new ConfigService();