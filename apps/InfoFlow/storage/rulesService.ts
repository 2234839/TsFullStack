import Dexie, { Table } from 'dexie';
import { defineProxyService } from '@webext-core/proxy-service';
import { taskGenerator } from '../utils/ruleTaskGenerator';
import { getTaskExecutionService } from './taskExecutionService';
import { infoFlowGetMessenger } from '../services/InfoFlowGet/messageProtocol';

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
  async getAll(options?: { limit?: number; offset?: number }): Promise<Rule[]> {
    let query = db.rules.toCollection();
    
    if (options?.limit !== undefined) {
      const offset = options.offset || 0;
      query = query.offset(offset).limit(options.limit);
    }
    
    return await query.toArray();
  }

  // 获取活动规则
  async getActiveRules(options?: { limit?: number; offset?: number }): Promise<Rule[]> {
    let query = db.rules.where('status').equals('active');
    
    if (options?.limit !== undefined) {
      const offset = options.offset || 0;
      query = query.offset(offset).limit(options.limit);
    }
    
    return await query.toArray();
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
const rulesServiceInstance = new RulesService();

// 使用 defineProxyService 模式
function createRulesService() {
  return {
    // 基础 CRUD 操作
    async create(rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<Rule> {
      return await rulesServiceInstance.create(rule);
    },

    async update(id: string, updates: Partial<Rule>): Promise<Rule | null> {
      return await rulesServiceInstance.update(id, updates);
    },

    async delete(id: string): Promise<boolean> {
      return await rulesServiceInstance.delete(id);
    },

    async getById(id: string): Promise<Rule | null> {
      return await rulesServiceInstance.getById(id);
    },

    async query(options: RuleQueryOptions = {}): Promise<PaginatedRules> {
      return await rulesServiceInstance.query(options);
    },

    async getAll(options?: { limit?: number; offset?: number }): Promise<Rule[]> {
      return await rulesServiceInstance.getAll(options);
    },

    async getActiveRules(): Promise<Rule[]> {
      return await rulesServiceInstance.getActiveRules();
    },

    async incrementExecutionCount(id: string): Promise<void> {
      return await rulesServiceInstance.incrementExecutionCount(id);
    },

    async updateNextExecution(id: string, nextExecutionAt: Date): Promise<void> {
      return await rulesServiceInstance.updateNextExecution(id, nextExecutionAt);
    },

    // RulesManager 的功能
    async createRule(ruleData: {
      name: string;
      description: string;
      cron: string;
      taskConfig: any;
      tags?: string[];
      priority?: number;
    }): Promise<Rule> {
      const rule = await this.create({
        ...ruleData,
        status: 'active'
      });

      // Start scheduling the rule
      await taskGenerator.scheduleRuleExecution(rule);

      return rule;
    },

    async updateRule(id: string, updates: Partial<Rule>): Promise<Rule | null> {
      const rule = await this.update(id, updates);

      if (rule) {
        // Cancel existing scheduling and reschedule if active
        await taskGenerator.cancelRuleExecution(id);
        if (rule.status === 'active') {
          await taskGenerator.scheduleRuleExecution(rule);
        }
      }

      return rule;
    },

    async deleteRule(id: string): Promise<boolean> {
      // Cancel scheduling before deleting
      await taskGenerator.cancelRuleExecution(id);
      return await this.delete(id);
    },

    async activateRule(id: string): Promise<Rule | null> {
      const rule = await this.updateRule(id, { status: 'active' });
      if (rule) {
        await taskGenerator.scheduleRuleExecution(rule);
      }
      return rule;
    },

    async pauseRule(id: string): Promise<Rule | null> {
      const rule = await this.updateRule(id, { status: 'paused' });
      if (rule) {
        await taskGenerator.cancelRuleExecution(id);
      }
      return rule;
    },

    async deactivateRule(id: string): Promise<Rule | null> {
      const rule = await this.updateRule(id, { status: 'inactive' });
      if (rule) {
        await taskGenerator.cancelRuleExecution(id);
      }
      return rule;
    },

    async getRuleStats(): Promise<{
      total: number;
      active: number;
      inactive: number;
      paused: number;
      totalExecutions: number;
    }> {
      const allRules = await this.getAll();

      return {
        total: allRules.length,
        active: allRules.filter(r => r.status === 'active').length,
        inactive: allRules.filter(r => r.status === 'inactive').length,
        paused: allRules.filter(r => r.status === 'paused').length,
        totalExecutions: allRules.reduce((sum, r) => sum + r.executionCount, 0)
      };
    },

    async executeRule(ruleId: string): Promise<{
      success: boolean;
      message: string;
      result?: any;
      executionId?: string;
    }> {
      let executionId: string | undefined;

      try {
        const rule = await this.getById(ruleId);
        if (!rule) {
          return { success: false, message: '规则不存在' };
        }

        // Create execution record
        const executionRecord = await getTaskExecutionService().createExecutionRecord(
          ruleId,
          rule.name,
          'manual'
        );
        executionId = executionRecord.id;

        // Start execution
        await getTaskExecutionService().startExecution(executionId);

        const task = taskGenerator.generateTaskFromRule(rule);
        const res = await infoFlowGetMessenger.sendMessage('runInfoFlowGet', task);
        console.log('[executeRule res]', res);

        if (!res) {
          await getTaskExecutionService().failExecution(executionId, '执行返回结果为空');
          return { success: false, message: '执行返回结果为空', executionId };
        }

        // Complete execution with result
        await getTaskExecutionService().completeExecution(
          executionId,
          res,
          res.matched
        );

        // Update rule execution count
        await this.incrementExecutionCount(ruleId);

        return {
          success: true,
          message: res.matched ? '执行成功' : '执行完成但未匹配到内容',
          result: res,
          executionId
        };
      } catch (error) {
        console.error('Failed to execute rule:', error);
        const errorMessage = error instanceof Error ? error.message : '未知错误';

        if (executionId) {
          await getTaskExecutionService().failExecution(executionId, errorMessage);
        }

        return {
          success: false,
          message: `执行失败: ${errorMessage}`,
          executionId
        };
      }
    }
  };
}

export const [registerRulesService, getRulesService] = defineProxyService(
  'rules-service',
  createRulesService,
);
