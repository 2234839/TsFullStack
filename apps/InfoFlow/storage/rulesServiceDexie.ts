import Dexie, { Table } from 'dexie';

// 定义规则类型
export interface Rule {
  id: string;
  name: string;
  description: string;
  cron: string;
  status: 'active' | 'inactive' | 'paused';
  taskConfig: any;
  createdAt: Date;
  updatedAt: Date;
  lastExecutedAt?: Date;
  nextExecutionAt?: Date;
  executionCount: number;
  tags?: string[];
  priority?: number;
}

// 定义查询选项
export interface RuleQueryOptions {
  page?: number;
  limit?: number;
  status?: Rule['status'];
  tags?: string[];
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'lastExecutedAt' | 'priority' | 'name';
  sortOrder?: 'asc' | 'desc';
}

// 定义分页结果
export interface PaginatedRules {
  rules: Rule[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 创建 Dexie 数据库
class RulesDatabase extends Dexie {
  rules!: Table<Rule, string>;

  constructor() {
    super('infoFlowRulesDB');
    
    // 定义数据库架构 - Dexie 会自动处理版本和索引
    this.version(1).stores({
      rules: `
        ++id,
        name,
        description,
        cron,
        status,
        createdAt,
        updatedAt,
        lastExecutedAt,
        nextExecutionAt,
        executionCount,
        tags,
        priority
      `
    });
  }
}

// 创建数据库实例
const db = new RulesDatabase();

// 规则服务
export class RulesService {
  // 创建规则
  async create(rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<Rule> {
    const newRule: Rule = {
      id: crypto.randomUUID(),
      ...rule,
      createdAt: new Date(),
      updatedAt: new Date(),
      executionCount: 0,
    };

    await db.rules.add(newRule);
    return newRule;
  }

  // 更新规则
  async update(id: string, updates: Partial<Rule>): Promise<Rule | null> {
    const existing = await db.rules.get(id);
    if (!existing) return null;

    const updatedRule: Rule = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await db.rules.put(updatedRule);
    return updatedRule;
  }

  // 删除规则
  async delete(id: string): Promise<boolean> {
    await db.rules.delete(id);
    return true;
  }

  // 根据 ID 获取规则
  async getById(id: string): Promise<Rule | null> {
    const result = await db.rules.get(id);
    return result || null;
  }

  // 查询规则
  async query(options: RuleQueryOptions = {}): Promise<PaginatedRules> {
    const {
      page = 1,
      limit = 20,
      status,
      tags,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    // 获取所有规则
    let rules = await db.rules.toArray();

    // 应用过滤条件
    if (status) {
      rules = rules.filter(item => item.status === status);
    }
    
    if (tags && tags.length > 0) {
      rules = rules.filter(item => {
        if (!item.tags || item.tags.length === 0) return false;
        return tags.every(tag => item.tags!.includes(tag));
      });
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      rules = rules.filter(item => 
        item.name.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
      );
    }

    // 排序
    rules.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (aValue instanceof Date) aValue = aValue.getTime();
      if (bValue instanceof Date) bValue = bValue.getTime();

      if (aValue === undefined || aValue === null) aValue = 0;
      if (bValue === undefined || bValue === null) bValue = 0;

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    // 分页
    const total = rules.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedRules = rules.slice(offset, offset + limit);

    return {
      rules: paginatedRules,
      total,
      page,
      limit,
      totalPages
    };
  }

  // 获取所有规则
  async getAll(): Promise<Rule[]> {
    return await db.rules.toArray();
  }

  // 获取活动规则
  async getActiveRules(): Promise<Rule[]> {
    const allRules = await db.rules.toArray();
    return allRules.filter(rule => rule.status === 'active');
  }

  // 增加执行计数
  async incrementExecutionCount(id: string): Promise<void> {
    const rule = await this.getById(id);
    if (rule) {
      await this.update(id, {
        executionCount: rule.executionCount + 1,
        lastExecutedAt: new Date()
      });
    }
  }

  // 更新下次执行时间
  async updateNextExecution(id: string, nextExecutionAt: Date): Promise<void> {
    await this.update(id, { nextExecutionAt });
  }

  // 重置数据库
  async reset(): Promise<void> {
    await db.delete();
    await db.open();
  }
}

// 创建服务实例
export const rulesService = new RulesService();