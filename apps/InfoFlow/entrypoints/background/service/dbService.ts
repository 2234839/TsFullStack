import Dexie, { Table } from 'dexie';
import { defineProxyService } from '@webext-core/proxy-service';

// 统一的数据库表定义
export interface ConfigTable {
  key: string;
  data: any;
}

export interface RulesTable {
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

export type Rule = RulesTable;

export interface RuleQueryOptions {
  page?: number;
  limit?: number;
  status?: Rule['status'];
  tags?: string[];
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'lastExecutedAt' | 'priority' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedRules {
  rules: Rule[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TaskExecutionsTable {
  id: string;
  ruleId: string;
  ruleName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  result?: any;
  error?: string;
  matched: boolean;
  matchedCount?: number;
  executionType: 'manual' | 'scheduled' | 'triggered';
  triggerInfo?: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskExecutionRecord = TaskExecutionsTable;

export interface TaskExecutionQueryOptions {
  page?: number;
  limit?: number;
  ruleId?: string;
  status?: TaskExecutionRecord['status'];
  executionType?: TaskExecutionRecord['executionType'];
  isRead?: boolean;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'createdAt' | 'updatedAt' | 'startTime' | 'endTime' | 'duration';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedTaskExecutions {
  executions: TaskExecutionRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 创建统一的数据库
class InfoFlowDatabase extends Dexie {
  configs!: Table<ConfigTable, string>;
  rules!: Table<RulesTable, string>;
  taskExecutions!: Table<TaskExecutionsTable, string>;

  constructor() {
    super('infoFlowDB');
    
    // 定义统一的数据库架构
    this.version(3).stores({
      // Config 表
      configs: 'key, data',
      
      // Rules 表 - 包含复合索引支持高效查询和排序
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
      `,
      
      // TaskExecutions 表 - 包含复合索引支持高效查询和排序
      taskExecutions: `
        ++id,
        ruleId,
        ruleName,
        status,
        startTime,
        endTime,
        duration,
        matched,
        executionType,
        isRead,
        createdAt,
        updatedAt,
        [ruleId+status],
        [ruleId+executionType],
        [ruleId+isRead],
        [status+createdAt],
        [executionType+createdAt],
        [isRead+createdAt],
        [createdAt+ruleId],
        [createdAt+status],
        [createdAt+executionType]
      `
    });
  }
}

// 创建数据库实例
const db = new InfoFlowDatabase();

// 数据库服务核心实现
export interface DbService {
  // Config 表操作
  configs: {
    getAll(options?: { limit?: number; offset?: number }): Promise<ConfigTable[]>;
    upsert(info: ConfigTable): Promise<void>;
    getItem(key: string): Promise<any>;
    setItem(key: string, data: any): Promise<void>;
    deleteItem(key: string): Promise<void>;
  };
  
  // Rules 表操作
  rules: {
    create(rule: Omit<RulesTable, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<RulesTable>;
    update(id: string, updates: Partial<RulesTable>): Promise<RulesTable | null>;
    delete(id: string): Promise<boolean>;
    getById(id: string): Promise<RulesTable | null>;
    query(options: RuleQueryOptions): Promise<PaginatedRules>;
    getAll(options?: { limit?: number; offset?: number }): Promise<RulesTable[]>;
    getActiveRules(options?: { limit?: number; offset?: number }): Promise<RulesTable[]>;
    incrementExecutionCount(id: string): Promise<void>;
    updateNextExecution(id: string, nextExecutionAt: Date): Promise<void>;
  };
  
  // TaskExecutions 表操作
  taskExecutions: {
    create(record: Omit<TaskExecutionsTable, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskExecutionsTable>;
    update(id: string, updates: Partial<TaskExecutionsTable>): Promise<TaskExecutionsTable | null>;
    markAsRead(id: string): Promise<TaskExecutionsTable | null>;
    markAsUnread(id: string): Promise<TaskExecutionsTable | null>;
    markAllAsRead(ruleId?: string): Promise<void>;
    delete(id: string): Promise<boolean>;
    getById(id: string): Promise<TaskExecutionsTable | null>;
    query(options: TaskExecutionQueryOptions): Promise<PaginatedTaskExecutions>;
    getByRuleId(ruleId: string, options?: Omit<TaskExecutionQueryOptions, 'ruleId'>): Promise<PaginatedTaskExecutions>;
    getRecentExecutions(ruleId?: string, limit?: number): Promise<TaskExecutionsTable[]>;
    getExecutionStats(ruleId?: string): Promise<{
      total: number;
      completed: number;
      failed: number;
      running: number;
      pending: number;
      averageDuration?: number;
      successRate: number;
    }>;
    startExecution(id: string): Promise<void>;
    completeExecution(id: string, result: any, matched: boolean, matchedCount?: number): Promise<void>;
    failExecution(id: string, error: string): Promise<void>;
    cancelExecution(id: string): Promise<void>;
    cleanupOldRecords(daysToKeep?: number): Promise<number>;
  };
  
  // 通用数据库操作
  reset(): Promise<void>;
}

// Config 表操作实现
const configsService = {
  async getAll(options?: { limit?: number; offset?: number }): Promise<ConfigTable[]> {
    let query = db.configs.toCollection();
    
    if (options?.limit !== undefined) {
      const offset = options.offset || 0;
      query = query.offset(offset).limit(options.limit);
    }
    
    return await query.toArray();
  },

  async upsert(info: ConfigTable): Promise<void> {
    await db.configs.put(info);
  },

  async getItem(key: string): Promise<any> {
    const result = await db.configs.get(key);
    return result?.data;
  },

  async setItem(key: string, data: any): Promise<void> {
    await db.configs.put({ key, data });
  },

  async deleteItem(key: string): Promise<void> {
    await db.configs.delete(key);
  }
};

// Rules 表操作实现
const rulesService = {
  async create(rule: Omit<RulesTable, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<RulesTable> {
    const newRule: RulesTable = {
      id: crypto.randomUUID(),
      ...rule,
      createdAt: new Date(),
      updatedAt: new Date(),
      executionCount: 0,
    };

    await db.rules.add(newRule);
    return newRule;
  },

  async update(id: string, updates: Partial<RulesTable>): Promise<RulesTable | null> {
    const existing = await db.rules.get(id);
    if (!existing) return null;

    const updatedRule: RulesTable = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await db.rules.put(updatedRule);
    return updatedRule;
  },

  async delete(id: string): Promise<boolean> {
    await db.rules.delete(id);
    return true;
  },

  async getById(id: string): Promise<RulesTable | null> {
    const result = await db.rules.get(id);
    return result || null;
  },

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
    let baseQuery: Dexie.Collection<RulesTable, string>;

    // 根据过滤条件选择最优的复合索引
    if (status && sortBy === 'createdAt') {
      baseQuery = sortOrder === 'desc' 
        ? db.rules.where('[status+createdAt]').between([status, new Date(0)], [status, new Date(9999, 11, 31)]).reverse()
        : db.rules.where('[status+createdAt]').between([status, new Date(0)], [status, new Date(9999, 11, 31)]);
    } else if (status && sortBy === 'priority') {
      baseQuery = sortOrder === 'desc' 
        ? db.rules.where('[status+priority]').between([status, -Infinity], [status, Infinity]).reverse()
        : db.rules.where('[status+priority]').between([status, -Infinity], [status, Infinity]);
    } else if (status && sortBy === 'name') {
      baseQuery = db.rules.where('[status+name]').between([status, ''], [status, '\\uffff']);
    } else if (status) {
      baseQuery = db.rules.where('status').equals(status);
    } else if (sortBy === 'createdAt') {
      baseQuery = sortOrder === 'desc' 
        ? db.rules.orderBy('createdAt').reverse()
        : db.rules.orderBy('createdAt');
    } else if (sortBy === 'priority') {
      baseQuery = sortOrder === 'desc' 
        ? db.rules.orderBy('priority').reverse()
        : db.rules.orderBy('priority');
    } else if (sortBy === 'name') {
      baseQuery = sortOrder === 'desc' 
        ? db.rules.orderBy('name').reverse()
        : db.rules.orderBy('name');
    } else {
      baseQuery = db.rules.toCollection();
    }

    // 应用额外的过滤条件
    let finalQuery = baseQuery;
    
    if (tags && tags.length > 0) {
      finalQuery = finalQuery.filter(item => {
        if (!item.tags || item.tags.length === 0) return false;
        return tags.every(tag => item.tags!.includes(tag));
      });
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      finalQuery = finalQuery.filter(item => 
        item.name.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
      );
    }

    const total = await finalQuery.count();
    const offset = (page - 1) * limit;
    const rules = await finalQuery.offset(offset).limit(limit).toArray();

    return {
      rules,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  async getAll(options?: { limit?: number; offset?: number }): Promise<RulesTable[]> {
    let query = db.rules.toCollection();
    
    if (options?.limit !== undefined) {
      const offset = options.offset || 0;
      query = query.offset(offset).limit(options.limit);
    }
    
    return await query.toArray();
  },

  async getActiveRules(options?: { limit?: number; offset?: number }): Promise<RulesTable[]> {
    let query = db.rules.where('status').equals('active');
    
    if (options?.limit !== undefined) {
      const offset = options.offset || 0;
      query = query.offset(offset).limit(options.limit);
    }
    
    return await query.toArray();
  },

  async incrementExecutionCount(id: string): Promise<void> {
    const rule = await this.getById(id);
    if (rule) {
      await this.update(id, {
        executionCount: rule.executionCount + 1,
        lastExecutedAt: new Date()
      });
    }
  },

  async updateNextExecution(id: string, nextExecutionAt: Date): Promise<void> {
    await this.update(id, { nextExecutionAt });
  }
};

// TaskExecutions 表操作实现
const taskExecutionsService = {
  async create(record: Omit<TaskExecutionsTable, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskExecutionsTable> {
    const newRecord: TaskExecutionsTable = {
      id: crypto.randomUUID(),
      ...record,
      isRead: record.isRead ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.taskExecutions.add(newRecord);
    return newRecord;
  },

  async update(id: string, updates: Partial<TaskExecutionsTable>): Promise<TaskExecutionsTable | null> {
    const existing = await db.taskExecutions.get(id);
    if (!existing) return null;

    const updatedRecord: TaskExecutionsTable = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await db.taskExecutions.put(updatedRecord);
    return updatedRecord;
  },

  async markAsRead(id: string): Promise<TaskExecutionsTable | null> {
    return await this.update(id, { isRead: true });
  },

  async markAsUnread(id: string): Promise<TaskExecutionsTable | null> {
    return await this.update(id, { isRead: false });
  },

  async markAllAsRead(ruleId?: string): Promise<void> {
    let query = db.taskExecutions.where('isRead').equals(0);
    
    if (ruleId) {
      query = query.and(item => item.ruleId === ruleId);
    }
    
    await query.each(async (item) => {
      await this.update(item.id, { isRead: true });
    });
  },

  async delete(id: string): Promise<boolean> {
    await db.taskExecutions.delete(id);
    return true;
  },

  async getById(id: string): Promise<TaskExecutionsTable | null> {
    const result = await db.taskExecutions.get(id);
    return result || null;
  },

  async query(options: TaskExecutionQueryOptions = {}): Promise<PaginatedTaskExecutions> {
    const {
      page = 1,
      limit = 20,
      ruleId,
      status,
      executionType,
      isRead,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    let baseQuery: Dexie.Collection<TaskExecutionsTable, string>;

    if (ruleId && status) {
      baseQuery = db.taskExecutions.where('[ruleId+status]').equals([ruleId, status]);
    } else if (ruleId && executionType) {
      baseQuery = db.taskExecutions.where('[ruleId+executionType]').equals([ruleId, executionType]);
    } else if (ruleId && isRead !== undefined) {
      baseQuery = db.taskExecutions.where('[ruleId+isRead]').equals([ruleId, isRead ? 1 : 0]);
    } else if (status && sortBy === 'createdAt') {
      baseQuery = db.taskExecutions.where('[status+createdAt]').between([status, startDate || new Date(0)], [status, endDate || new Date(9999, 11, 31)]);
    } else if (executionType && sortBy === 'createdAt') {
      baseQuery = db.taskExecutions.where('[executionType+createdAt]').between([executionType, startDate || new Date(0)], [executionType, endDate || new Date(9999, 11, 31)]);
    } else if (isRead !== undefined && sortBy === 'createdAt') {
      baseQuery = db.taskExecutions.where('[isRead+createdAt]').between([isRead ? 1 : 0, startDate || new Date(0)], [isRead ? 1 : 0, endDate || new Date(9999, 11, 31)]);
    } else if (ruleId) {
      baseQuery = db.taskExecutions.where('ruleId').equals(ruleId);
    } else if (status) {
      baseQuery = db.taskExecutions.where('status').equals(status);
    } else if (executionType) {
      baseQuery = db.taskExecutions.where('executionType').equals(executionType);
    } else if (isRead !== undefined) {
      baseQuery = db.taskExecutions.where('isRead').equals(isRead ? 1 : 0);
    } else if (startDate || endDate) {
      if (startDate && endDate) {
        baseQuery = db.taskExecutions.where('createdAt').between(startDate, endDate);
      } else if (startDate) {
        baseQuery = db.taskExecutions.where('createdAt').aboveOrEqual(startDate);
      } else {
        baseQuery = db.taskExecutions.where('createdAt').belowOrEqual(endDate);
      }
    } else {
      if (sortBy === 'createdAt') {
        baseQuery = sortOrder === 'desc' 
          ? db.taskExecutions.orderBy('createdAt').reverse()
          : db.taskExecutions.orderBy('createdAt');
      } else {
        baseQuery = db.taskExecutions.toCollection();
      }
    }

    let finalQuery = baseQuery;
    
    if (ruleId && !(status || executionType || isRead !== undefined)) {
      if (status) {
        finalQuery = finalQuery.and(item => item.status === status);
      }
      if (executionType) {
        finalQuery = finalQuery.and(item => item.executionType === executionType);
      }
      if (isRead !== undefined) {
        finalQuery = finalQuery.and(item => item.isRead === isRead);
      }
    }
    
    if (startDate && !(status && sortBy === 'createdAt' || executionType && sortBy === 'createdAt' || isRead !== undefined && sortBy === 'createdAt')) {
      finalQuery = finalQuery.and(item => item.createdAt >= startDate);
    }
    if (endDate && !(status && sortBy === 'createdAt' || executionType && sortBy === 'createdAt' || isRead !== undefined && sortBy === 'createdAt')) {
      finalQuery = finalQuery.and(item => item.createdAt <= endDate);
    }

    const total = await finalQuery.count();
    const offset = (page - 1) * limit;
    const executions = await finalQuery.offset(offset).limit(limit).toArray();

    return {
      executions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  async getByRuleId(ruleId: string, options?: Omit<TaskExecutionQueryOptions, 'ruleId'>): Promise<PaginatedTaskExecutions> {
    return await this.query({ ...options, ruleId });
  },

  async getRecentExecutions(ruleId?: string, limit: number = 10): Promise<TaskExecutionsTable[]> {
    const result = await this.query({ ruleId, limit, sortBy: 'createdAt', sortOrder: 'desc' });
    return result.executions;
  },

  async getExecutionStats(ruleId?: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    running: number;
    pending: number;
    averageDuration?: number;
    successRate: number;
  }> {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    let baseQuery = db.taskExecutions.where('createdAt').aboveOrEqual(cutoffDate);
    
    if (ruleId) {
      baseQuery = baseQuery.and(item => item.ruleId === ruleId);
    }

    const totalQuery = baseQuery.clone();
    const completedQuery = baseQuery.clone().and(item => item.status === 'completed');
    const failedQuery = baseQuery.clone().and(item => item.status === 'failed');
    const runningQuery = baseQuery.clone().and(item => item.status === 'running');
    const pendingQuery = baseQuery.clone().and(item => item.status === 'pending');

    const [total, completed, failed, running, pending] = await Promise.all([
      totalQuery.count(),
      completedQuery.count(),
      failedQuery.count(),
      runningQuery.count(),
      pendingQuery.count()
    ]);

    const successRate = total > 0 ? (completed / total) * 100 : 0;

    let averageDuration: number | undefined;
    if (completed > 0) {
      const durationQuery = baseQuery.clone()
        .and(item => item.status === 'completed' && item.duration !== undefined);
      
      const completedWithDuration = await durationQuery.toArray();
      if (completedWithDuration.length > 0) {
        averageDuration = completedWithDuration.reduce((sum, e) => sum + (e.duration || 0), 0) / completedWithDuration.length;
      }
    }

    return {
      total,
      completed,
      failed,
      running,
      pending,
      averageDuration,
      successRate
    };
  },

  async startExecution(id: string): Promise<void> {
    await this.update(id, {
      status: 'running',
      startTime: new Date()
    });
  },

  async completeExecution(id: string, result: any, matched: boolean, matchedCount?: number): Promise<void> {
    const execution = await this.getById(id);
    if (!execution) return;

    const duration = execution.startTime ? Date.now() - execution.startTime.getTime() : undefined;

    await this.update(id, {
      status: 'completed',
      endTime: new Date(),
      duration,
      result,
      matched,
      matchedCount
    });
  },

  async failExecution(id: string, error: string): Promise<void> {
    const execution = await this.getById(id);
    if (!execution) return;

    const duration = execution.startTime ? Date.now() - execution.startTime.getTime() : undefined;

    await this.update(id, {
      status: 'failed',
      endTime: new Date(),
      duration,
      error
    });
  },

  async cancelExecution(id: string): Promise<void> {
    const execution = await this.getById(id);
    if (!execution) return;

    const duration = execution.startTime ? Date.now() - execution.startTime.getTime() : undefined;

    await this.update(id, {
      status: 'cancelled',
      endTime: new Date(),
      duration
    });
  },

  async cleanupOldRecords(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    let deletedCount = 0;
    
    await db.taskExecutions
      .where('createdAt')
      .below(cutoffDate)
      .eachPrimaryKey((key) => {
        db.taskExecutions.delete(key);
        deletedCount++;
      });
    
    return deletedCount;
  }
};

// 通用数据库操作
async function reset(): Promise<void> {
  await db.delete();
  await db.open();
}

// 使用 defineProxyService 模式
function createDbService(): DbService {
  return {
    configs: configsService,
    rules: rulesService,
    taskExecutions: taskExecutionsService,
    reset
  };
}

export const [registerDbService, getDbService] = defineProxyService(
  'db-service',
  createDbService,
);