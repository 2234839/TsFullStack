// 使用 Dexie.js 替代原生 IndexedDB，避免所有版本冲突和索引问题
import { defineProxyService } from '@webext-core/proxy-service';
import { taskExecutionService } from './taskExecutionServiceDexie';
import type {
  TaskExecutionRecord,
  TaskExecutionQueryOptions,
  PaginatedTaskExecutions
} from './taskExecutionServiceDexie';

// 重新导出类型以保持兼容性
export type {
  TaskExecutionRecord,
  TaskExecutionQueryOptions,
  PaginatedTaskExecutions
} from './taskExecutionServiceDexie';

// 创建适配器函数来兼容现有接口
function createTaskExecutionService() {
  return {
    async create(record: Omit<TaskExecutionRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskExecutionRecord> {
      return await taskExecutionService.create(record);
    },

    async update(id: string, updates: Partial<TaskExecutionRecord>): Promise<TaskExecutionRecord | null> {
      return await taskExecutionService.update(id, updates);
    },

    async markAsRead(id: string): Promise<TaskExecutionRecord | null> {
      return await taskExecutionService.markAsRead(id);
    },

    async markAsUnread(id: string): Promise<TaskExecutionRecord | null> {
      return await taskExecutionService.markAsUnread(id);
    },

    async markAllAsRead(ruleId?: string): Promise<void> {
      return await taskExecutionService.markAllAsRead(ruleId);
    },

    async migrateLegacyRecords(): Promise<void> {
      // Dexie 自动处理，不需要迁移
    },

    async delete(id: string): Promise<boolean> {
      return await taskExecutionService.delete(id);
    },

    async getById(id: string): Promise<TaskExecutionRecord | null> {
      return await taskExecutionService.getById(id);
    },

    async query(options: TaskExecutionQueryOptions = {}): Promise<PaginatedTaskExecutions> {
      return await taskExecutionService.query(options);
    },

    async getByRuleId(ruleId: string, options?: Omit<TaskExecutionQueryOptions, 'ruleId'>): Promise<PaginatedTaskExecutions> {
      return await taskExecutionService.getByRuleId(ruleId, options);
    },

    async getRecentExecutions(ruleId?: string, limit: number = 10): Promise<TaskExecutionRecord[]> {
      return await taskExecutionService.getRecentExecutions(ruleId, limit);
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
      return await taskExecutionService.getExecutionStats(ruleId);
    },

    async startExecution(id: string): Promise<void> {
      return await taskExecutionService.startExecution(id);
    },

    async completeExecution(id: string, result: any, matched: boolean, matchedCount?: number): Promise<void> {
      return await taskExecutionService.completeExecution(id, result, matched, matchedCount);
    },

    async failExecution(id: string, error: string): Promise<void> {
      return await taskExecutionService.failExecution(id, error);
    },

    async cancelExecution(id: string): Promise<void> {
      return await taskExecutionService.cancelExecution(id);
    },

    async cleanupOldRecords(daysToKeep: number = 30): Promise<number> {
      return await taskExecutionService.cleanupOldRecords(daysToKeep);
    },
  };
}

export const [registerTaskExecutionService, getTaskExecutionService] = defineProxyService(
  'task-execution-service',
  createTaskExecutionService,
);