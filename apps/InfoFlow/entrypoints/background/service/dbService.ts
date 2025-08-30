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
  priority?: number;
}

export type Rule = RulesTable;

export interface RuleQueryOptions {
  page?: number;
  limit?: number;
  status?: Rule['status'];
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'lastExecutedAt' | 'priority' | 'name' | 'nextExecutionAt' | 'unreadFirst';
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
  matched: 0 | 1;
  matchedCount?: number;
  executionType: 'manual' | 'scheduled' | 'triggered';
  triggerInfo?: string;
  metadata?: Record<string, any>;
  isRead: 0 | 1;
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
  isRead?: 0 | 1;
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
// 支持的键值类型
// - 数字 (number)
// - 字符串 (string)
// - Date 对象
// - 数组 (array) - 但必须是有限深度且只包含有效键类型
// 不支持的类型
// - 布尔值 (boolean)  ！！
// - 对象 (object)
// - null
// - undefined
// - 函数
// - Symbol

// 查询性能优化策略：
// 1. 优先使用复合索引
// 2. 避免全量扫描，设置合理的默认时间范围
// 3. 使用批量操作替代逐条操作
// 4. 合理使用 and() 过滤器，避免索引失效
class InfoFlowDatabase extends Dexie {
  configs!: Table<ConfigTable, string>;
  rules!: Table<RulesTable, string>;
  taskExecutions!: Table<TaskExecutionsTable, string>;

  constructor() {
    super('infoFlowDB');

    // 定义统一的数据库架构
    this.version(1).stores({
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
        [ruleId+createdAt],
        [ruleId+status+createdAt],
        [ruleId+executionType+createdAt],
        [ruleId+isRead+createdAt],
        [ruleId+status+isRead+createdAt],
        [status+createdAt],
        [executionType+createdAt],
        [isRead+createdAt],
        [createdAt+ruleId],
        [createdAt+status],
        [createdAt+executionType]
      `,
    });

    // 升级到版本 2，添加更多索引
    this.version(2).upgrade(async (tx) => {
      console.log('[调试] 升级数据库到版本 2');
    });

    // 升级到版本 5，添加四重复合索引
    this.version(5).upgrade(async (tx) => {
      console.log('[调试] 升级数据库到版本 5，添加四重复合索引');
    });
  }
}

// 创建数据库实例
const db = new InfoFlowDatabase();

// 数据库服务核心实现

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
  },
};

// Rules 表操作实现
const rulesService = {
  async create(
    rule: Omit<RulesTable, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>,
  ): Promise<RulesTable> {
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

  async createWithId(rule: RulesTable): Promise<RulesTable> {
    const newRule: RulesTable = {
      ...rule,
      createdAt: new Date(),
      updatedAt: new Date(),
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
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    // 特殊处理 unreadFirst 排序
    if (sortBy === 'unreadFirst') {
      return await this.queryWithUnreadFirst(options);
    }

    // 使用复合索引进行高效查询
    let baseQuery: Dexie.Collection<RulesTable, string>;

    // 根据过滤条件选择最优的复合索引
    if (status && sortBy === 'createdAt') {
      baseQuery =
        sortOrder === 'desc'
          ? db.rules
              .where('[status+createdAt]')
              .between([status, new Date(0)], [status, new Date(9999, 11, 31)])
              .reverse()
          : db.rules
              .where('[status+createdAt]')
              .between([status, new Date(0)], [status, new Date(9999, 11, 31)]);
    } else if (status && sortBy === 'priority') {
      baseQuery =
        sortOrder === 'desc'
          ? db.rules
              .where('[status+priority]')
              .between([status, -Infinity], [status, Infinity])
              .reverse()
          : db.rules.where('[status+priority]').between([status, -Infinity], [status, Infinity]);
    } else if (status && sortBy === 'name') {
      baseQuery = db.rules.where('[status+name]').between([status, ''], [status, '\\uffff']);
    } else if (status && sortBy === 'nextExecutionAt') {
      baseQuery =
        sortOrder === 'desc'
          ? db.rules.orderBy('nextExecutionAt').reverse()
          : db.rules.orderBy('nextExecutionAt');
    } else if (status) {
      baseQuery = db.rules.where('status').equals(status);
    } else if (sortBy === 'createdAt') {
      baseQuery =
        sortOrder === 'desc'
          ? db.rules.orderBy('createdAt').reverse()
          : db.rules.orderBy('createdAt');
    } else if (sortBy === 'updatedAt') {
      baseQuery =
        sortOrder === 'desc'
          ? db.rules.orderBy('updatedAt').reverse()
          : db.rules.orderBy('updatedAt');
    } else if (sortBy === 'lastExecutedAt') {
      baseQuery =
        sortOrder === 'desc'
          ? db.rules.orderBy('lastExecutedAt').reverse()
          : db.rules.orderBy('lastExecutedAt');
    } else if (sortBy === 'priority') {
      baseQuery =
        sortOrder === 'desc'
          ? db.rules.orderBy('priority').reverse()
          : db.rules.orderBy('priority');
    } else if (sortBy === 'name') {
      baseQuery =
        sortOrder === 'desc' ? db.rules.orderBy('name').reverse() : db.rules.orderBy('name');
    } else if (sortBy === 'nextExecutionAt') {
      baseQuery =
        sortOrder === 'desc'
          ? db.rules.orderBy('nextExecutionAt').reverse()
          : db.rules.orderBy('nextExecutionAt');
    } else {
      // 避免全量查询，默认使用 createdAt 索引
      baseQuery = db.rules.orderBy('createdAt');
      if (sortOrder === 'desc') {
        baseQuery = baseQuery.reverse();
      }
    }

    // 应用额外的过滤条件
    let finalQuery = baseQuery;

    if (search) {
      const searchLower = search.toLowerCase();
      finalQuery = finalQuery.filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          item.description.toLowerCase().includes(searchLower),
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
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * 支持按未读执行记录优先排序的查询方法
   */
  async queryWithUnreadFirst(options: RuleQueryOptions = {}): Promise<PaginatedRules> {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortOrder = 'desc',
    } = options;

    // 获取所有符合基础条件的规则
    const baseOptions = { ...options, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };
    const baseResult = await this.query(baseOptions);

    // 获取所有规则并检查未读状态
    const rulesWithUnreadStatus = await Promise.all(
      baseResult.rules.map(async (rule) => {
        const hasUnread = await this.hasUnreadExecutions(rule.id);
        return { ...rule, hasUnread };
      })
    );

    // 按未读状态和下次执行时间排序
    const sortedRules = rulesWithUnreadStatus.sort((a, b) => {
      // 首先按未读状态排序（有未读的排在前面）
      if (a.hasUnread && !b.hasUnread) return -1;
      if (!a.hasUnread && b.hasUnread) return 1;

      // 如果未读状态相同，则按下次执行时间排序（即将执行的排在前面）
      const aNextTime = a.nextExecutionAt ? new Date(a.nextExecutionAt) : null;
      const bNextTime = b.nextExecutionAt ? new Date(b.nextExecutionAt) : null;

      // 如果都没有下次执行时间，按创建时间排序
      if (!aNextTime && !bNextTime) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      // 如果只有一个有下次执行时间，有时间的排在前面
      if (aNextTime && !bNextTime) return -1;
      if (!aNextTime && bNextTime) return 1;

      // 如果都有下次执行时间，按时间先后排序（越早执行的排在前面）
      return aNextTime!.getTime() - bNextTime!.getTime();
    });

    // 应用分页
    const offset = (page - 1) * limit;
    const paginatedRules = sortedRules.slice(offset, offset + limit);

    return {
      rules: paginatedRules,
      total: baseResult.total,
      page,
      limit,
      totalPages: Math.ceil(baseResult.total / limit),
    };
  },

  /**
   * 检查规则是否有未读的执行记录
   */
  async hasUnreadExecutions(ruleId: string): Promise<boolean> {
    const taskExecutionService = await this.getTaskExecutionService();
    return await taskExecutionService.hasUnreadExecutions(ruleId);
  },

  /**
   * 获取任务执行服务实例
   */
  getTaskExecutionService() {
    // 延迟导入以避免循环依赖
    return import('./taskExecutionService').then(module => module.getTaskExecutionService());
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
        lastExecutedAt: new Date(),
      });
    }
  },

  async updateNextExecution(id: string, nextExecutionAt: Date): Promise<void> {
    await this.update(id, { nextExecutionAt });
  },
};

// TaskExecutions 表操作实现
const taskExecutionsService = {
  async create(
    record: Omit<TaskExecutionsTable, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<TaskExecutionsTable> {
    const newRecord: TaskExecutionsTable = {
      id: crypto.randomUUID(),
      ...record,
      isRead: record.isRead ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.taskExecutions.add(newRecord);
    return newRecord;
  },

  async update(
    id: string,
    updates: Partial<TaskExecutionsTable>,
  ): Promise<TaskExecutionsTable | null> {
    const existing = await db.taskExecutions.get(id);
    if (!existing) return null;

    // 处理 isRead 的类型转换，确保是 0 | 1
    const processedUpdates = { ...updates };
    if (updates.isRead !== undefined) {
      processedUpdates.isRead = updates.isRead ? 1 : 0;
    }

    const updatedRecord: TaskExecutionsTable = {
      ...existing,
      ...processedUpdates,
      updatedAt: new Date(),
    };

    await db.taskExecutions.put(updatedRecord);
    return updatedRecord;
  },

  async markAsRead(id: string): Promise<TaskExecutionsTable | null> {
    return await this.update(id, { isRead: 1 });
  },

  async markAsUnread(id: string): Promise<TaskExecutionsTable | null> {
    return await this.update(id, { isRead: 0 });
  },

  async markAllAsRead(ruleId?: string): Promise<void> {
    let query: Dexie.Collection<TaskExecutionsTable, string>;

    if (ruleId) {
      // 使用复合索引 [ruleId+isRead] 提高性能
      query = db.taskExecutions.where('[ruleId+isRead]').equals([ruleId, 0]);
    } else {
      query = db.taskExecutions.where('isRead').equals(0);
    }

    // 批量更新，避免逐条操作
    const unreadIds = await query.primaryKeys();
    if (unreadIds.length > 0) {
      await db.taskExecutions.where(':id').anyOf(unreadIds).modify({ isRead: 1 });
    }
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
    console.log('[调试] 查询调用参数:', options);

    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    // 确定查询类型
    const queryType = this.determineQueryType(options);
    console.log('[调试] 查询类型:', queryType);

    // 根据查询类型构建基础查询
    let baseQuery = this.buildBaseQuery(queryType, options);
    console.log('[调试] 基础查询已选择，现在应用额外过滤器...');

    // 应用额外的过滤条件
    const { finalQuery, appliedFilters } = this.applyAdditionalFilters(
      baseQuery,
      options,
      queryType,
    );
    console.log('[调试] 应用的过滤器:', appliedFilters);

    // 应用排序逻辑
    const sortedQuery = this.applySorting(finalQuery, sortBy, sortOrder, queryType);

    // 执行查询
    const total = await sortedQuery.count();
    const offset = (page - 1) * limit;
    const executions = await sortedQuery.offset(offset).limit(limit).toArray();

    console.log('[调试] 最终查询结果: ', {
      原始参数: options,
      查询类型: queryType,
      应用过滤器: appliedFilters,
      总记录数: total,
      返回记录数: executions.length,
      分页信息: { 页码: page, 每页限制: limit, 偏移量: offset },
      首条记录: executions[0]
        ? {
            id: executions[0].id,
            ruleId: executions[0].ruleId,
            isRead: executions[0].isRead,
            status: executions[0].status,
          }
        : null,
    });

    return {
      executions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * 确定查询类型
   */
  determineQueryType(options: TaskExecutionQueryOptions): 'compound' | 'single' | 'date' | 'all' {
    const { ruleId, status, executionType, isRead, startDate, endDate, sortBy } = options;

    // 复合索引查询：多个条件的组合
    if (ruleId && (status || executionType || isRead !== undefined)) {
      return 'compound';
    }

    // 日期范围查询：优先使用复合索引
    if ((status || executionType || isRead !== undefined) && sortBy === 'createdAt') {
      return 'compound';
    }

    // 单一条件查询
    if (ruleId || status || executionType || isRead !== undefined) {
      return 'single';
    }

    // 纯日期范围查询
    if (startDate || endDate) {
      return 'date';
    }

    // 默认查询所有
    return 'all';
  },

  /**
   * 根据查询类型构建基础查询
   */
  buildBaseQuery(
    queryType: 'compound' | 'single' | 'date' | 'all',
    options: TaskExecutionQueryOptions,
  ): Dexie.Collection<TaskExecutionsTable, string> {
    switch (queryType) {
      case 'compound':
        return this.buildCompoundQuery(options);

      case 'single':
        return this.buildSingleQuery(options);

      case 'date':
        return this.buildDateQuery(options);

      case 'all':
      default:
        return this.buildAllQuery(options);
    }
  },

  /**
   * 构建复合索引查询
   */
  buildCompoundQuery(
    options: TaskExecutionQueryOptions,
  ): Dexie.Collection<TaskExecutionsTable, string> {
    const { ruleId, status, executionType, isRead, startDate, endDate, sortBy } = options;

    if (ruleId && status) {
      return db.taskExecutions.where('[ruleId+status]').equals([ruleId, status]);
    }

    if (ruleId && executionType) {
      return db.taskExecutions.where('[ruleId+executionType]').equals([ruleId, executionType]);
    }

    if (ruleId && isRead !== undefined) {
      return db.taskExecutions.where('[ruleId+isRead]').equals([ruleId, isRead]);
    }

    if (status && sortBy === 'createdAt') {
      return db.taskExecutions
        .where('[status+createdAt]')
        .between([status, startDate || new Date(0)], [status, endDate || new Date(9999, 11, 31)]);
    }

    if (executionType && sortBy === 'createdAt') {
      return db.taskExecutions
        .where('[executionType+createdAt]')
        .between(
          [executionType, startDate || new Date(0)],
          [executionType, endDate || new Date(9999, 11, 31)],
        );
    }

    if (isRead !== undefined && sortBy === 'createdAt') {
      return db.taskExecutions
        .where('[isRead+createdAt]')
        .between(
          [isRead ? 1 : 0, startDate || new Date(0)],
          [isRead ? 1 : 0, endDate || new Date(9999, 11, 31)],
        );
    }

    // 默认返回 ruleId 查询
    return db.taskExecutions.where('ruleId').equals(ruleId!);
  },

  /**
   * 构建单一条件查询
   */
  buildSingleQuery(
    options: TaskExecutionQueryOptions,
  ): Dexie.Collection<TaskExecutionsTable, string> {
    const { ruleId, status, executionType, isRead } = options;

    if (ruleId) {
      return db.taskExecutions.where('ruleId').equals(ruleId);
    }

    if (status) {
      return db.taskExecutions.where('status').equals(status);
    }

    if (executionType) {
      return db.taskExecutions.where('executionType').equals(executionType);
    }

    if (isRead !== undefined) {
      return db.taskExecutions.where('isRead').equals(isRead ? 1 : 0);
    }

    // 默认查询
    return db.taskExecutions.toCollection();
  },

  /**
   * 构建日期范围查询
   */
  buildDateQuery(
    options: TaskExecutionQueryOptions,
  ): Dexie.Collection<TaskExecutionsTable, string> {
    const { startDate, endDate } = options;

    if (startDate && endDate) {
      return db.taskExecutions.where('createdAt').between(startDate, endDate);
    }

    if (startDate) {
      return db.taskExecutions.where('createdAt').aboveOrEqual(startDate);
    }

    if (endDate) {
      return db.taskExecutions.where('createdAt').belowOrEqual(endDate);
    }

    // 默认查询
    return db.taskExecutions.toCollection();
  },

  /**
   * 构建默认查询（所有记录）
   */
  buildAllQuery(options: TaskExecutionQueryOptions): Dexie.Collection<TaskExecutionsTable, string> {
    const { sortOrder } = options;

    // 避免全量查询，使用 createdAt 索引并限制时间范围
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    let query = db.taskExecutions.where('createdAt').aboveOrEqual(ninetyDaysAgo);

    if (sortOrder === 'desc') {
      query = query.reverse();
    }

    return query;
  },

  /**
   * 应用额外的过滤条件
   */
  applyAdditionalFilters(
    baseQuery: Dexie.Collection<TaskExecutionsTable, string>,
    options: TaskExecutionQueryOptions,
    queryType: 'compound' | 'single' | 'date' | 'all',
  ): { finalQuery: Dexie.Collection<TaskExecutionsTable, string>; appliedFilters: string[] } {
    const { ruleId, status, executionType, isRead, startDate, endDate, sortBy } = options;
    let finalQuery = baseQuery;
    const appliedFilters: string[] = [];

    // 对于单一查询且包含 ruleId 的情况，应用其他过滤条件
    if (queryType === 'single' && ruleId) {
      if (status) {
        finalQuery = finalQuery.and((item) => item.status === status);
        appliedFilters.push(`状态: ${status}`);
      }
      if (executionType) {
        finalQuery = finalQuery.and((item) => item.executionType === executionType);
        appliedFilters.push(`执行类型: ${executionType}`);
      }
      if (isRead !== undefined) {
        finalQuery = finalQuery.and((item) => item.isRead === isRead);
        appliedFilters.push(`已读状态: ${isRead}`);
      }
    }

    // 应用日期过滤（如果不在复合查询中已经处理）
    const isDateInCompound =
      (status || executionType || isRead !== undefined) && sortBy === 'createdAt';
    if (!isDateInCompound) {
      if (startDate) {
        finalQuery = finalQuery.and((item) => item.createdAt >= startDate);
        appliedFilters.push(`开始日期 >= ${startDate}`);
      }
      if (endDate) {
        finalQuery = finalQuery.and((item) => item.createdAt <= endDate);
        appliedFilters.push(`结束日期 <= ${endDate}`);
      }
    }

    return { finalQuery, appliedFilters };
  },

  /**
   * 应用排序逻辑
   */
  applySorting(
    query: Dexie.Collection<TaskExecutionsTable, string>,
    _sortBy: string,
    sortOrder: 'asc' | 'desc',
    _queryType: 'compound' | 'single' | 'date' | 'all',
  ): Dexie.Collection<TaskExecutionsTable, string> {
    let finalQuery = query;

    // 应用排序方向
    if (sortOrder === 'desc') {
      finalQuery = finalQuery.reverse();
    }

    return finalQuery;
  },

  async getPaginatedExecutionsByRuleId(
    ruleId: string,
    options: {
      page?: number;
      limit?: number;
      status?: TaskExecutionsTable['status'];
      isRead?: 0 | 1;
    } = {}
  ): Promise<PaginatedTaskExecutions> {
    const {
      page = 1,
      limit = 20,
      status,
      isRead,
    } = options;

    // 优先使用复合索引，确保按 createdAt 降序
    let baseQuery: Dexie.Collection<TaskExecutionsTable, string>;

    if (status && isRead !== undefined) {
      baseQuery = db.taskExecutions
        .where('[ruleId+status+isRead+createdAt]')
        .between(
          [ruleId, status, isRead, new Date(0)],
          [ruleId, status, isRead, new Date(9999, 11, 31)],
        )
        .reverse();
    } else if (status) {
      baseQuery = db.taskExecutions
        .where('[ruleId+status+createdAt]')
        .between(
          [ruleId, status, new Date(0)],
          [ruleId, status, new Date(9999, 11, 31)],
        )
        .reverse();
    } else if (isRead !== undefined) {
      baseQuery = db.taskExecutions
        .where('[ruleId+isRead+createdAt]')
        .between(
          [ruleId, isRead, new Date(0)],
          [ruleId, isRead, new Date(9999, 11, 31)],
        )
        .reverse();
    } else {
      // 使用 [ruleId+createdAt] 复合索引，直接按 createdAt 降序
      baseQuery = db.taskExecutions
        .where('[ruleId+createdAt]')
        .between(
          [ruleId, new Date(0)],
          [ruleId, new Date(9999, 11, 31)],
        )
        .reverse();
    }

    const total = await baseQuery.count();
    const offset = (page - 1) * limit;
    const executions = await baseQuery.offset(offset).limit(limit).toArray();

    return {
      executions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async hasUnreadExecutions(ruleId: string): Promise<boolean> {
    // 使用 [ruleId+isRead+createdAt] 复合索引查询是否存在未读记录
    const count = await db.taskExecutions
      .where('[ruleId+isRead+createdAt]')
      .between([ruleId, 0, new Date(0)], [ruleId, 0, new Date(9999, 11, 31)])
      .count();

    return count > 0;
  },

  async getRecentExecutions(ruleId?: string, limit: number = 10): Promise<TaskExecutionsTable[]> {
    console.log('[调试] getRecentExecutions 调用参数:', { ruleId, limit });

    // 专门为获取最近执行记录优化的逻辑
    let baseQuery: Dexie.Collection<TaskExecutionsTable, string>;

    if (ruleId) {
      // 使用复合索引 [ruleId+createdAt] 直接获取降序结果
      baseQuery = db.taskExecutions
        .where('[ruleId+createdAt]')
        .between([ruleId, new Date(0)], [ruleId, new Date(9999, 11, 31)])
        .reverse();
    } else {
      // 直接按 createdAt 降序
      baseQuery = db.taskExecutions.orderBy('createdAt').reverse();
    }

    const executions = await baseQuery.limit(limit).toArray();
    console.log('[调试] getRecentExecutions 结果:', {
      ruleId,
      请求限制: limit,
      返回记录数: executions.length,
      首条记录时间: executions[0]?.createdAt,
      末条记录时间: executions[executions.length - 1]?.createdAt,
    });

    return executions;
  },

  async getLastSuccessfulExecution(ruleId: string): Promise<TaskExecutionsTable | null> {
    // 使用复合索引 [ruleId+status+createdAt] 查询最后一次成功执行
    const lastExecution = await db.taskExecutions
      .where('[ruleId+status+createdAt]')
      .between([ruleId, 'completed', new Date(0)], [ruleId, 'completed', new Date(9999, 11, 31)])
      .reverse()
      .limit(1)
      .first();

    return lastExecution || null;
  },

  async getPreviousSuccessfulExecution(ruleId: string, excludeExecutionId: string): Promise<TaskExecutionsTable | null> {
    // 使用复合索引 [ruleId+status+createdAt] 查询最新的2条成功执行记录
    const executions = await db.taskExecutions
      .where('[ruleId+status+createdAt]')
      .between([ruleId, 'completed', new Date(0)], [ruleId, 'completed', new Date(9999, 11, 31)])
      .reverse()
      .limit(2)
      .toArray();

    // 如果最新的一条不是要排除的，那就是上一次执行
    // 如果最新的是要排除的，那么第二条就是上一次执行
    const previousExecution = executions.find(exec => exec.id !== excludeExecutionId);

    return previousExecution || null;
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

    let baseQuery: Dexie.Collection<TaskExecutionsTable, string>;

    if (ruleId) {
      // 使用复合索引 [ruleId+createdAt] 提高性能
      baseQuery = db.taskExecutions
        .where('[ruleId+createdAt]')
        .between([ruleId, cutoffDate], [ruleId, new Date(9999, 11, 31)]);
    } else {
      baseQuery = db.taskExecutions.where('createdAt').aboveOrEqual(cutoffDate);
    }

    const totalQuery = baseQuery.clone();
    const completedQuery = baseQuery.clone().and((item) => item.status === 'completed');
    const failedQuery = baseQuery.clone().and((item) => item.status === 'failed');
    const runningQuery = baseQuery.clone().and((item) => item.status === 'running');
    const pendingQuery = baseQuery.clone().and((item) => item.status === 'pending');

    const [total, completed, failed, running, pending] = await Promise.all([
      totalQuery.count(),
      completedQuery.count(),
      failedQuery.count(),
      runningQuery.count(),
      pendingQuery.count(),
    ]);

    const successRate = total > 0 ? (completed / total) * 100 : 0;

    let averageDuration: number | undefined;
    if (completed > 0) {
      const durationQuery = baseQuery
        .clone()
        .and((item) => item.status === 'completed' && item.duration !== undefined);

      const completedWithDuration = await durationQuery.toArray();
      if (completedWithDuration.length > 0) {
        averageDuration =
          completedWithDuration.reduce((sum, e) => sum + (e.duration || 0), 0) /
          completedWithDuration.length;
      }
    }

    return {
      total,
      completed,
      failed,
      running,
      pending,
      averageDuration,
      successRate,
    };
  },

  async startExecution(id: string): Promise<void> {
    await this.update(id, {
      status: 'running',
      startTime: new Date(),
    });
  },

  async completeExecution(
    id: string,
    result: any,
    matched: 0 | 1,
    matchedCount?: number,
  ): Promise<void> {
    const execution = await this.getById(id);
    if (!execution) return;

    const duration = execution.startTime ? Date.now() - execution.startTime.getTime() : undefined;

    await this.update(id, {
      status: 'completed',
      endTime: new Date(),
      duration,
      result,
      matched,
      matchedCount,
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
      error,
    });
  },

  async cancelExecution(id: string): Promise<void> {
    const execution = await this.getById(id);
    if (!execution) return;

    const duration = execution.startTime ? Date.now() - execution.startTime.getTime() : undefined;

    await this.update(id, {
      status: 'cancelled',
      endTime: new Date(),
      duration,
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
  },
};

// 通用数据库操作
async function reset(): Promise<void> {
  await db.delete();
  await db.open();
}

// 使用 defineProxyService 模式
function createDbService() {
  // 初始化时检查并修复索引
  initDatabase();

  return {
    configs: configsService,
    rules: rulesService,
    taskExecutions: taskExecutionsService,
    reset,
  };
}

// 初始化数据库并检查索引
async function initDatabase() {
  console.log('[调试] 初始化数据库，当前版本:', db.verno);

  // 强制打开数据库以确保版本升级
  try {
    await db.open();
    console.log('[调试] 数据库已打开，当前版本:', db.verno);

    // 检查索引状态
    const indexes = db.taskExecutions.schema.indexes || {};
    console.log('[调试] 当前索引:', Object.keys(indexes));

    // 测试复合索引是否工作
    const testQuery = db.taskExecutions.where('[ruleId+isRead]');
    console.log('[调试] 复合索引查询对象:', testQuery);
  } catch (error) {
    console.error('[调试] 数据库初始化失败:', error);
  }
}

export const [registerDbService, getDbService] = defineProxyService('db-service', createDbService);
