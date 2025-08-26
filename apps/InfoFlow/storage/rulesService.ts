import { defineProxyService } from '@webext-core/proxy-service';
import { rulesService } from './rulesServiceDexie';
import type {
  Rule,
  RuleQueryOptions,
  PaginatedRules
} from './rulesServiceDexie';

// 重新导出类型以保持兼容性
export type {
  Rule,
  RuleQueryOptions,
  PaginatedRules
} from './rulesServiceDexie';

function createRulesService() {
  return {
    async create(rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<Rule> {
      return await rulesService.create(rule);
    },

    async update(id: string, updates: Partial<Rule>): Promise<Rule | null> {
      return await rulesService.update(id, updates);
    },

    async delete(id: string): Promise<boolean> {
      return await rulesService.delete(id);
    },

    async getById(id: string): Promise<Rule | null> {
      return await rulesService.getById(id);
    },

    async query(options: RuleQueryOptions = {}): Promise<PaginatedRules> {
      return await rulesService.query(options);
    },

    async getAll(): Promise<Rule[]> {
      return await rulesService.getAll();
    },

    async getActiveRules(): Promise<Rule[]> {
      return await rulesService.getActiveRules();
    },

    async incrementExecutionCount(id: string): Promise<void> {
      return await rulesService.incrementExecutionCount(id);
    },

    async updateNextExecution(id: string, nextExecutionAt: Date): Promise<void> {
      return await rulesService.updateNextExecution(id, nextExecutionAt);
    }
  };
}

export const [registerRulesService, getRulesService] = defineProxyService(
  'rules-service',
  createRulesService,
);