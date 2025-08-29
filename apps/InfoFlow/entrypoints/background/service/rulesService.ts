import { defineProxyService } from '@webext-core/proxy-service';
import { getDbService } from './dbService';
import { executeRuleLogic } from '@/utils/ruleTaskGenerator';
import { getCronService } from './cronService';

// 重新导出类型，保持兼容性
export type { Rule } from './dbService';
export type { RuleQueryOptions, PaginatedRules } from './dbService';

// 规则服务 - 基于统一的数据库服务
function createRulesService() {
  return {
    // 基础 CRUD 操作
    async create(
      rule: Omit<
        import('./dbService').RulesTable,
        'id' | 'createdAt' | 'updatedAt' | 'executionCount'
      >,
    ): Promise<import('./dbService').RulesTable> {
      const dbService = getDbService();
      const newRule = await dbService.rules.create(rule);

      // Reinitialize all crons when any rule is created
      const cronService = getCronService();
      await cronService.reinitializeCrons();

      return newRule;
    },

    async update(
      id: string,
      updates: Partial<import('./dbService').RulesTable>,
    ): Promise<import('./dbService').RulesTable | null> {
      const dbService = getDbService();
      const rule = await dbService.rules.update(id, updates);

      if (rule) {
        // Reinitialize all crons when any rule is updated
        const cronService = getCronService();
        await cronService.reinitializeCrons();
      }

      return rule;
    },

    async delete(id: string): Promise<boolean> {
      const dbService = getDbService();
      const result = await dbService.rules.delete(id);

      if (result) {
        const cronService = getCronService();
        await cronService.reinitializeCrons();
      }

      return result;
    },

    async getById(id: string): Promise<import('./dbService').RulesTable | null> {
      const dbService = getDbService();
      return await dbService.rules.getById(id);
    },

    async query(options: any = {}): Promise<{
      rules: import('./dbService').RulesTable[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }> {
      const dbService = getDbService();
      return await dbService.rules.query(options);
    },

    async getAll(options?: {
      limit?: number;
      offset?: number;
    }): Promise<import('./dbService').RulesTable[]> {
      const dbService = getDbService();
      return await dbService.rules.getAll(options);
    },

    async getActiveRules(options?: {
      limit?: number;
      offset?: number;
    }): Promise<import('./dbService').RulesTable[]> {
      const dbService = getDbService();
      return await dbService.rules.getActiveRules(options);
    },

    async incrementExecutionCount(id: string): Promise<void> {
      const dbService = getDbService();
      await dbService.rules.incrementExecutionCount(id);
    },

    async updateNextExecution(id: string, nextExecutionAt: Date): Promise<void> {
      const dbService = getDbService();
      await dbService.rules.updateNextExecution(id, nextExecutionAt);
    },

    async reset(): Promise<void> {
      const dbService = getDbService();
      await dbService.reset();
    },

    // RulesManager 的功能
    async createRule(ruleData: {
      name: string;
      description: string;
      cron: string;
      taskConfig: any;
      tags?: string[];
      priority?: number;
    }): Promise<import('./dbService').RulesTable> {
      return await this.create({
        ...ruleData,
        status: 'active',
      });
    },

    async updateRule(
      id: string,
      updates: Partial<import('./dbService').RulesTable>,
    ): Promise<import('./dbService').RulesTable | null> {
      return await this.update(id, updates);
    },

    async deleteRule(id: string): Promise<boolean> {
      return await this.delete(id);
    },

    async activateRule(id: string): Promise<import('./dbService').RulesTable | null> {
      return await this.update(id, { status: 'active' });
    },

    async pauseRule(id: string): Promise<import('./dbService').RulesTable | null> {
      return await this.update(id, { status: 'paused' });
    },

    async deactivateRule(id: string): Promise<import('./dbService').RulesTable | null> {
      return await this.update(id, { status: 'inactive' });
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
        active: allRules.filter((r) => r.status === 'active').length,
        inactive: allRules.filter((r) => r.status === 'inactive').length,
        paused: allRules.filter((r) => r.status === 'paused').length,
        totalExecutions: allRules.reduce((sum, r) => sum + r.executionCount, 0),
      };
    },

    async executeRule(ruleId: string): Promise<{
      success: boolean;
      message: string;
      result?: any;
      executionId?: string;
    }> {
      const rule = await this.getById(ruleId);
      if (!rule) {
        return { success: false, message: '规则不存在' };
      }

      return await executeRuleLogic(rule, 'manual');
    },
  };
}

export const [registerRulesService, getRulesService] = defineProxyService(
  'rules-service',
  createRulesService,
);
