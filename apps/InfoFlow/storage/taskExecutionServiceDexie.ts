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
    
    // 定义数据库架构 - 添加复合索引支持高效查询和排序
    this.version(2).stores({
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
    // 使用 cursor-based 批量更新，避免加载所有未读项目到内存
    let query = db.taskExecutions.where('isRead').equals(0);
    
    if (ruleId) {
      query = query.and(item => item.ruleId === ruleId);
    }
    
    // 使用游标进行批量更新
    await query.each(async (item) => {
      await this.update(item.id, { isRead: true });
    });
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

    // 使用复合索引进行高效查询
    let baseQuery: Dexie.Collection<TaskExecutionRecord, string>;

    // 根据过滤条件选择最优的复合索引
    if (ruleId && status) {
      // 使用 [ruleId+status] 复合索引
      baseQuery = db.taskExecutions.where('[ruleId+status]').equals([ruleId, status]);
    } else if (ruleId && executionType) {
      // 使用 [ruleId+executionType] 复合索引
      baseQuery = db.taskExecutions.where('[ruleId+executionType]').equals([ruleId, executionType]);
    } else if (ruleId && isRead !== undefined) {
      // 使用 [ruleId+isRead] 复合索引
      baseQuery = db.taskExecutions.where('[ruleId+isRead]').equals([ruleId, isRead ? 1 : 0]);
    } else if (status && sortBy === 'createdAt') {
      // 使用 [status+createdAt] 复合索引
      baseQuery = db.taskExecutions.where('[status+createdAt]').between([status, startDate || new Date(0)], [status, endDate || new Date(9999, 11, 31)]);
    } else if (executionType && sortBy === 'createdAt') {
      // 使用 [executionType+createdAt] 复合索引
      baseQuery = db.taskExecutions.where('[executionType+createdAt]').between([executionType, startDate || new Date(0)], [executionType, endDate || new Date(9999, 11, 31)]);
    } else if (isRead !== undefined && sortBy === 'createdAt') {
      // 使用 [isRead+createdAt] 复合索引
      baseQuery = db.taskExecutions.where('[isRead+createdAt]').between([isRead ? 1 : 0, startDate || new Date(0)], [isRead ? 1 : 0, endDate || new Date(9999, 11, 31)]);
    } else if (ruleId) {
      // 使用 ruleId 索引
      baseQuery = db.taskExecutions.where('ruleId').equals(ruleId);
    } else if (status) {
      // 使用 status 索引
      baseQuery = db.taskExecutions.where('status').equals(status);
    } else if (executionType) {
      // 使用 executionType 索引
      baseQuery = db.taskExecutions.where('executionType').equals(executionType);
    } else if (isRead !== undefined) {
      // 使用 isRead 索引
      baseQuery = db.taskExecutions.where('isRead').equals(isRead ? 1 : 0);
    } else if (startDate || endDate) {
      // 使用 createdAt 索引进行日期范围查询
      if (startDate && endDate) {
        baseQuery = db.taskExecutions.where('createdAt').between(startDate, endDate);
      } else if (startDate) {
        baseQuery = db.taskExecutions.where('createdAt').aboveOrEqual(startDate);
      } else {
        baseQuery = db.taskExecutions.where('createdAt').belowOrEqual(endDate);
      }
    } else {
      // 使用默认的排序索引
      if (sortBy === 'createdAt') {
        baseQuery = sortOrder === 'desc' 
          ? db.taskExecutions.orderBy('createdAt').reverse()
          : db.taskExecutions.orderBy('createdAt');
      } else {
        baseQuery = db.taskExecutions.toCollection();
      }
    }

    // 应用额外的过滤条件（如果复合索引没有完全覆盖）
    let finalQuery = baseQuery;
    
    // 应用未被复合索引覆盖的过滤条件
    if (ruleId && !(status || executionType || isRead !== undefined)) {
      // 如果只有 ruleId 过滤，但还有其他条件
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
    
    // 应用日期过滤（如果还没有被复合索引覆盖）
    if (startDate && !(status && sortBy === 'createdAt' || executionType && sortBy === 'createdAt' || isRead !== undefined && sortBy === 'createdAt')) {
      finalQuery = finalQuery.and(item => item.createdAt >= startDate);
    }
    if (endDate && !(status && sortBy === 'createdAt' || executionType && sortBy === 'createdAt' || isRead !== undefined && sortBy === 'createdAt')) {
      finalQuery = finalQuery.and(item => item.createdAt <= endDate);
    }

    // 获取总数用于分页
    const total = await finalQuery.count();

    // 应用排序（如果还没有被复合索引覆盖）
    let sortedQuery = finalQuery;
    
    if (sortBy === 'createdAt' && !(ruleId || status || executionType || isRead !== undefined || startDate || endDate)) {
      // 已经通过 orderBy 处理了
    } else if (sortBy !== 'createdAt' || sortOrder === 'asc') {
      // 对于其他排序字段，使用 offsetLimit 进行分页
      const offset = (page - 1) * limit;
      const executions = await finalQuery.offset(offset).limit(limit).toArray();
      
      // 在内存中排序（只对当前页的数据进行排序）
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

      return {
        executions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    // 使用 Dexie 的分页
    const offset = (page - 1) * limit;
    const executions = await sortedQuery.offset(offset).limit(limit).toArray();

    return {
      executions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
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
    
    // 使用数据库查询而不是加载所有数据
    let baseQuery = db.taskExecutions.where('createdAt').aboveOrEqual(cutoffDate);
    
    if (ruleId) {
      baseQuery = baseQuery.and(item => item.ruleId === ruleId);
    }

    // 分别查询各个状态的数量，避免加载所有数据
    const totalQuery = baseQuery.clone();
    const completedQuery = baseQuery.clone().and(item => item.status === 'completed');
    const failedQuery = baseQuery.clone().and(item => item.status === 'failed');
    const runningQuery = baseQuery.clone().and(item => item.status === 'running');
    const pendingQuery = baseQuery.clone().and(item => item.status === 'pending');

    // 并行查询所有统计信息
    const [total, completed, failed, running, pending] = await Promise.all([
      totalQuery.count(),
      completedQuery.count(),
      failedQuery.count(),
      runningQuery.count(),
      pendingQuery.count()
    ]);

    const successRate = total > 0 ? (completed / total) * 100 : 0;

    // 计算平均执行时间 - 只查询已完成且有执行时间的记录
    let averageDuration: number | undefined;
    if (completed > 0) {
      const durationQuery = baseQuery.clone()
        .and(item => item.status === 'completed' && item.duration !== undefined);
      
      // 使用聚合查询计算平均执行时间
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
    
    // 使用 cursor-based 删除，避免加载所有记录到内存
    let deletedCount = 0;
    
    await db.taskExecutions
      .where('createdAt')
      .below(cutoffDate)
      .eachPrimaryKey((key) => {
        // 使用主键删除，更高效
        db.taskExecutions.delete(key);
        deletedCount++;
      });
    
    return deletedCount;
  }

  // 重置数据库
  async reset(): Promise<void> {
    await db.delete();
    await db.open();
  }
}

// 创建服务实例
export const taskExecutionService = new TaskExecutionService();