import { defineProxyService } from '@webext-core/proxy-service';
import { getDbService, type TaskExecutionsTable } from './dbService';

// 重新导出类型，保持兼容性
export type { TaskExecutionRecord } from './dbService';
export type { TaskExecutionQueryOptions, PaginatedTaskExecutions } from './dbService';

// 任务执行服务 - 基于统一的数据库服务
function createTaskExecutionService() {
  return {
    // 基础 CRUD 操作
    async create(
      record: Omit<import('./dbService').TaskExecutionsTable, 'id' | 'createdAt' | 'updatedAt'>,
    ): Promise<import('./dbService').TaskExecutionsTable> {
      const dbService = getDbService();
      return await dbService.taskExecutions.create(record);
    },

    async update(
      id: string,
      updates: Partial<import('./dbService').TaskExecutionsTable>,
    ): Promise<import('./dbService').TaskExecutionsTable | null> {
      const dbService = getDbService();
      return await dbService.taskExecutions.update(id, updates);
    },

    async markAsRead(id: string): Promise<import('./dbService').TaskExecutionsTable | null> {
      const dbService = getDbService();
      return await dbService.taskExecutions.markAsRead(id);
    },

    async markAsUnread(id: string): Promise<import('./dbService').TaskExecutionsTable | null> {
      const dbService = getDbService();
      return await dbService.taskExecutions.markAsUnread(id);
    },

    async markAllAsRead(ruleId?: string): Promise<void> {
      const dbService = getDbService();
      await dbService.taskExecutions.markAllAsRead(ruleId);
    },

    async delete(id: string): Promise<boolean> {
      const dbService = getDbService();
      return await dbService.taskExecutions.delete(id);
    },

    async getById(id: string): Promise<import('./dbService').TaskExecutionsTable | null> {
      const dbService = getDbService();
      return await dbService.taskExecutions.getById(id);
    },

    async query(options: any = {}): Promise<{
      executions: import('./dbService').TaskExecutionsTable[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }> {
      const dbService = getDbService();
      return await dbService.taskExecutions.query(options);
    },

    async getPaginatedExecutionsByRuleId(
      ruleId: string,
      options?: {
        page?: number;
        limit?: number;
        status?: TaskExecutionsTable['status'];
        isRead?: 0 | 1;
      },
    ): Promise<{
      executions: TaskExecutionsTable[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }> {
      const dbService = getDbService();
      return await dbService.taskExecutions.getPaginatedExecutionsByRuleId(ruleId, options);
    },

    async hasUnreadExecutions(ruleId: string): Promise<boolean> {
      const dbService = getDbService();
      return await dbService.taskExecutions.hasUnreadExecutions(ruleId);
    },

    // 保持向后兼容性
    async getByRuleId(ruleId: string, options?: any): Promise<any> {
      return await this.getPaginatedExecutionsByRuleId(ruleId, options);
    },

    async getRecentExecutions(
      ruleId?: string,
      limit: number = 10,
    ): Promise<import('./dbService').TaskExecutionsTable[]> {
      const dbService = getDbService();
      return await dbService.taskExecutions.getRecentExecutions(ruleId, limit);
    },

    async getLastSuccessfulExecution(ruleId: string): Promise<import('./dbService').TaskExecutionsTable | null> {
      const dbService = getDbService();
      return await dbService.taskExecutions.getLastSuccessfulExecution(ruleId);
    },

    async getPreviousSuccessfulExecution(ruleId: string, excludeExecutionId: string): Promise<import('./dbService').TaskExecutionsTable | null> {
      const dbService = getDbService();
      return await dbService.taskExecutions.getPreviousSuccessfulExecution(ruleId, excludeExecutionId);
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
      const dbService = getDbService();
      return await dbService.taskExecutions.getExecutionStats(ruleId);
    },

    async startExecution(id: string): Promise<void> {
      const dbService = getDbService();
      await dbService.taskExecutions.startExecution(id);
    },

    async completeExecution(
      id: string,
      result: any,
      matched: 0 | 1,
      matchedCount?: number,
    ): Promise<void> {
      const dbService = getDbService();
      await dbService.taskExecutions.completeExecution(id, result, matched, matchedCount);
    },

    async failExecution(id: string, error: string): Promise<void> {
      const dbService = getDbService();
      await dbService.taskExecutions.failExecution(id, error);
    },

    async cancelExecution(id: string): Promise<void> {
      const dbService = getDbService();
      await dbService.taskExecutions.cancelExecution(id);
    },

    async cleanupOldRecords(daysToKeep: number = 30): Promise<number> {
      const dbService = getDbService();
      return await dbService.taskExecutions.cleanupOldRecords(daysToKeep);
    },

    async getTotalUnreadCount(): Promise<number> {
      const dbService = getDbService();
      return await dbService.taskExecutions.getTotalUnreadCount();
    },

    async getRulesWithUnreadExecutions(): Promise<string[]> {
      const dbService = getDbService();
      return await dbService.taskExecutions.getRulesWithUnreadExecutions();
    },

    async getRulesWithUnreadExecutionsWithDetails(): Promise<Array<{id: string, name: string}>> {
      const dbService = getDbService();
      const ruleIds = await dbService.taskExecutions.getRulesWithUnreadExecutions();
      const rulesWithDetails = [];
      console.log('[ruleIds]',ruleIds);
      for (const ruleId of ruleIds) {
        const rule = await dbService.rules.getById(ruleId);
        if (rule) {
          rulesWithDetails.push({
            id: rule.id,
            name: rule.name
          });
        }
      }

      return rulesWithDetails;
    },

    async reset(): Promise<void> {
      const dbService = getDbService();
      await dbService.reset();
    },

    // TaskExecutionManager 的额外功能
    async createExecutionRecord(
      ruleId: string,
      ruleName: string,
      executionType: import('./dbService').TaskExecutionsTable['executionType'] = 'manual',
      triggerInfo?: string,
    ): Promise<import('./dbService').TaskExecutionsTable> {
      return await this.create({
        ruleId,
        ruleName,
        status: 'pending',
        matched: 0,
        executionType,
        triggerInfo,
        isRead: 0, // 新创建的记录默认为未读
      });
    },

    async getExecutionTimeline(
      ruleId: string,
      days: number = 7,
    ): Promise<
      {
        date: string;
        executions: number;
        completed: number;
        failed: number;
      }[]
    > {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const executions = await this.query({
        ruleId,
        startDate,
        endDate,
        limit: 10000,
      });

      const timeline = new Map<string, { executions: number; completed: number; failed: number }>();

      // Initialize timeline
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        timeline.set(dateStr, { executions: 0, completed: 0, failed: 0 });
      }

      // Aggregate data
      executions.executions.forEach((execution: import('./dbService').TaskExecutionsTable) => {
        const dateStr = execution.createdAt.toISOString().split('T')[0];
        const dayData = timeline.get(dateStr);
        if (dayData) {
          dayData.executions++;
          if (execution.status === 'completed') {
            dayData.completed++;
          } else if (execution.status === 'failed') {
            dayData.failed++;
          }
        }
      });

      return Array.from(timeline.entries()).map(([date, data]) => ({
        date,
        ...data,
      }));
    },
  };
}

export const [registerTaskExecutionService, getTaskExecutionService] = defineProxyService(
  'task-execution-service',
  createTaskExecutionService,
);
