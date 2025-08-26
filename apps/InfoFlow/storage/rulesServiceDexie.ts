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
    
    // 定义数据库架构 - 添加复合索引支持高效查询和排序
    this.version(2).stores({
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
        priority,
        [status+createdAt],
        [status+priority],
        [status+name],
        [createdAt+status],
        [priority+status],
        [name+status]
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

    // 使用复合索引进行高效查询
    let baseQuery: Dexie.Collection<Rule, string>;

    // 根据过滤条件选择最优的复合索引
    if (status && sortBy === 'createdAt') {
      // 使用 [status+createdAt] 复合索引
      baseQuery = sortOrder === 'desc' 
        ? db.rules.where('[status+createdAt]').between([status, new Date(0)], [status, new Date(9999, 11, 31)]).reverse()
        : db.rules.where('[status+createdAt]').between([status, new Date(0)], [status, new Date(9999, 11, 31)]);
    } else if (status && sortBy === 'priority') {
      // 使用 [status+priority] 复合索引
      baseQuery = sortOrder === 'desc' 
        ? db.rules.where('[status+priority]').between([status, -Infinity], [status, Infinity]).reverse()
        : db.rules.where('[status+priority]').between([status, -Infinity], [status, Infinity]);
    } else if (status && sortBy === 'name') {
      // 使用 [status+name] 复合索引
      baseQuery = db.rules.where('[status+name]').between([status, ''], [status, '\uffff']);
    } else if (status) {
      // 使用 status 索引
      baseQuery = db.rules.where('status').equals(status);
    } else if (sortBy === 'createdAt') {
      // 使用默认的 createdAt 排序
      baseQuery = sortOrder === 'desc' 
        ? db.rules.orderBy('createdAt').reverse()
        : db.rules.orderBy('createdAt');
    } else if (sortBy === 'priority') {
      // 使用 priority 索引
      baseQuery = sortOrder === 'desc' 
        ? db.rules.orderBy('priority').reverse()
        : db.rules.orderBy('priority');
    } else if (sortBy === 'name') {
      // 使用 name 索引
      baseQuery = sortOrder === 'desc' 
        ? db.rules.orderBy('name').reverse()
        : db.rules.orderBy('name');
    } else {
      // 默认集合
      baseQuery = db.rules.toCollection();
    }

    // 应用额外的过滤条件
    let finalQuery = baseQuery;
    
    // 标签过滤（需要在内存中进行，因为标签是数组）
    if (tags && tags.length > 0) {
      finalQuery = finalQuery.filter(item => {
        if (!item.tags || item.tags.length === 0) return false;
        return tags.every(tag => item.tags!.includes(tag));
      });
    }
    
    // 搜索过滤（需要在内存中进行，因为涉及文本搜索）
    if (search) {
      const searchLower = search.toLowerCase();
      finalQuery = finalQuery.filter(item => 
        item.name.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
      );
    }

    // 获取总数用于分页
    const total = await finalQuery.count();

    // 应用排序（如果还没有被复合索引覆盖）
    let sortedQuery = finalQuery;
    
    if (sortBy !== 'createdAt' && sortBy !== 'priority' && sortBy !== 'name') {
      // 对于其他排序字段，使用 offsetLimit 进行分页
      const offset = (page - 1) * limit;
      const rules = await finalQuery.offset(offset).limit(limit).toArray();
      
      // 在内存中排序（只对当前页的数据进行排序）
      rules.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];

        // 处理日期类型
        let comparisonValue: number;
        if (aValue instanceof Date || bValue instanceof Date) {
          const timeA = aValue instanceof Date ? aValue.getTime() : 0;
          const timeB = bValue instanceof Date ? bValue.getTime() : 0;
          comparisonValue = timeA - timeB;
        } else {
          // 处理数字类型
          const numA = typeof aValue === 'number' ? aValue : 0;
          const numB = typeof bValue === 'number' ? bValue : 0;
          comparisonValue = numA - numB;
        }

        return sortOrder === 'asc' ? comparisonValue : -comparisonValue;
      });

      return {
        rules,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    // 使用 Dexie 的分页
    const offset = (page - 1) * limit;
    const rules = await sortedQuery.offset(offset).limit(limit).toArray();

    return {
      rules,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  // 获取所有规则
  async getAll(): Promise<Rule[]> {
    return await db.rules.toArray();
  }

  // 获取活动规则
  async getActiveRules(): Promise<Rule[]> {
    return await db.rules.where('status').equals('active').toArray();
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