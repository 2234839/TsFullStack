import Dexie, { Table } from 'dexie';

// 定义任务执行记录的类型
export interface TaskExecutionRecord {
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

// 定义查询选项
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

// 定义分页结果
export interface PaginatedTaskExecutions {
  executions: TaskExecutionRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 创建 Dexie 数据库
class TaskExecutionDatabase extends Dexie {
  taskExecutions!: Table<TaskExecutionRecord, string>;

  constructor() {
    super('infoFlowTaskExecutionsDB');
    
    // 定义数据库架构 - Dexie 会自动处理版本和索引
    this.version(1).stores({
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
        updatedAt
      `
    });
  }
}

// 创建数据库实例
const db = new TaskExecutionDatabase();

// 任务执行服务
export class TaskExecutionService {
  // 创建任务执行记录
  async create(record: Omit<TaskExecutionRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskExecutionRecord> {
    const newRecord: TaskExecutionRecord = {
      id: crypto.randomUUID(),
      ...record,
      isRead: record.isRead ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.taskExecutions.add(newRecord);
    return newRecord;
  }

  // 更新任务执行记录
  async update(id: string, updates: Partial<TaskExecutionRecord>): Promise<TaskExecutionRecord | null> {
    const existing = await db.taskExecutions.get(id);
    if (!existing) return null;

    const updatedRecord: TaskExecutionRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await db.taskExecutions.put(updatedRecord);
    return updatedRecord;
  }

  // 标记为已读
  async markAsRead(id: string): Promise<TaskExecutionRecord | null> {
    return await this.update(id, { isRead: true });
  }

  // 标记为未读
  async markAsUnread(id: string): Promise<TaskExecutionRecord | null> {
    return await this.update(id, { isRead: false });
  }

  // 标记所有为已读
  async markAllAsRead(ruleId?: string): Promise<void> {
    // 使用 Dexie 的 where 子句进行高效查询
    let query = db.taskExecutions.where('isRead').equals(0);
    
    if (ruleId) {
      query = query.and(item => item.ruleId === ruleId);
    }
    
    const unreadItems = await query.toArray();
    
    // 批量更新
    for (const item of unreadItems) {
      await this.update(item.id, { isRead: true });
    }
  }

  // 删除任务执行记录
  async delete(id: string): Promise<boolean> {
    await db.taskExecutions.delete(id);
    return true;
  }

  // 根据 ID 获取任务执行记录
  async getById(id: string): Promise<TaskExecutionRecord | null> {
    const result = await db.taskExecutions.get(id);
    return result || null;
  }

  // 查询任务执行记录
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

    // 构建查询 - 使用 Dexie 的复合查询
    let query: Dexie.Collection<TaskExecutionRecord, string> | undefined;

    // 应用过滤条件 - 使用数据库索引查询
    if (ruleId) {
      query = db.taskExecutions.where('ruleId').equals(ruleId);
    }
    
    if (status) {
      if (query) {
        query = query.and(item => item.status === status);
      } else {
        query = db.taskExecutions.where('status').equals(status);
      }
    }
    
    if (executionType) {
      if (query) {
        query = query.and(item => item.executionType === executionType);
      } else {
        query = db.taskExecutions.where('executionType').equals(executionType);
      }
    }
    
    if (isRead !== undefined) {
      if (query) {
        query = query.and(item => item.isRead === isRead);
      } else {
        query = db.taskExecutions.where('isRead').equals(isRead ? 1 : 0);
      }
    }
    
    if (startDate) {
      if (query) {
        query = query.and(item => item.createdAt >= startDate);
      } else {
        query = db.taskExecutions.where('createdAt').aboveOrEqual(startDate);
      }
    }
    
    if (endDate) {
      if (query) {
        query = query.and(item => item.createdAt <= endDate);
      } else {
        query = db.taskExecutions.where('createdAt').belowOrEqual(endDate);
      }
    }

    // 如果没有应用任何 where 子句，使用默认集合
    if (!query) {
      query = db.taskExecutions.toCollection();
    }

    // 获取总数用于分页
    const total = await query.count();

    // 使用 Dexie 的排序
    let executions = await query.toArray();
    
    // 在内存中排序（Dexie 的 sortBy 返回 Promise，不是 Collection）
    executions.sort((a, b) => {
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
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedExecutions = executions.slice(offset, offset + limit);

    return {
      executions: paginatedExecutions,
      total,
      page,
      limit,
      totalPages
    };
  }

  // 根据规则 ID 获取任务执行记录
  async getByRuleId(ruleId: string, options?: Omit<TaskExecutionQueryOptions, 'ruleId'>): Promise<PaginatedTaskExecutions> {
    return await this.query({ ...options, ruleId });
  }

  // 获取最近的任务执行记录
  async getRecentExecutions(ruleId?: string, limit: number = 10): Promise<TaskExecutionRecord[]> {
    const result = await this.query({ ruleId, limit, sortBy: 'createdAt', sortOrder: 'desc' });
    return result.executions;
  }

  // 获取执行统计
  async getExecutionStats(ruleId?: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    running: number;
    pending: number;
    averageDuration?: number;
    successRate: number;
  }> {
    // 只统计最近90天的数据
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    let query = db.taskExecutions.where('createdAt').aboveOrEqual(cutoffDate);
    
    if (ruleId) {
      query = query.and(item => item.ruleId === ruleId);
    }

    const executions = await query.toArray();
    
    const total = executions.length;
    const completed = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const running = executions.filter(e => e.status === 'running').length;
    const pending = executions.filter(e => e.status === 'pending').length;
    const successRate = total > 0 ? (completed / total) * 100 : 0;

    // 计算平均执行时间
    const completedExecutions = executions.filter(e => e.status === 'completed');
    const completedWithDuration = completedExecutions.filter(e => e.duration !== undefined);
    const averageDuration = completedWithDuration.length > 0 
      ? completedWithDuration.reduce((sum, e) => sum + (e.duration || 0), 0) / completedWithDuration.length
      : undefined;

    return {
      total,
      completed,
      failed,
      running,
      pending,
      averageDuration,
      successRate
    };
  }

  // 开始执行
  async startExecution(id: string): Promise<void> {
    await this.update(id, {
      status: 'running',
      startTime: new Date()
    });
  }

  // 完成执行
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
  }

  // 执行失败
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
  }

  // 取消执行
  async cancelExecution(id: string): Promise<void> {
    const execution = await this.getById(id);
    if (!execution) return;

    const duration = execution.startTime ? Date.now() - execution.startTime.getTime() : undefined;

    await this.update(id, {
      status: 'cancelled',
      endTime: new Date(),
      duration
    });
  }

  // 清理旧记录
  async cleanupOldRecords(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const oldRecords = await db.taskExecutions
      .where('createdAt')
      .below(cutoffDate)
      .toArray();
    
    for (const record of oldRecords) {
      await db.taskExecutions.delete(record.id);
    }
    
    return oldRecords.length;
  }

  // 重置数据库
  async reset(): Promise<void> {
    await db.delete();
    await db.open();
  }
}

// 创建服务实例
export const taskExecutionService = new TaskExecutionService();