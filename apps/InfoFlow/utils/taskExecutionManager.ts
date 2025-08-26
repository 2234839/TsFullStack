import { getTaskExecutionService } from '../storage/taskExecutionService';
import type { TaskExecutionRecord, TaskExecutionQueryOptions } from '../storage/taskExecutionService';

export class TaskExecutionManager {
  private taskExecutionService = getTaskExecutionService();

  async createExecutionRecord(ruleId: string, ruleName: string, executionType: TaskExecutionRecord['executionType'] = 'manual', triggerInfo?: string): Promise<TaskExecutionRecord> {
    return await this.taskExecutionService.create({
      ruleId,
      ruleName,
      status: 'pending',
      matched: false,
      executionType,
      triggerInfo
    });
  }

  async getExecutions(options?: TaskExecutionQueryOptions): Promise<{
    executions: TaskExecutionRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return await this.taskExecutionService.query(options);
  }

  async getRuleExecutions(ruleId: string, options?: Omit<TaskExecutionQueryOptions, 'ruleId'>): Promise<{
    executions: TaskExecutionRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return await this.taskExecutionService.getByRuleId(ruleId, options);
  }

  async getRecentExecutions(ruleId?: string, limit: number = 10): Promise<TaskExecutionRecord[]> {
    return await this.taskExecutionService.getRecentExecutions(ruleId, limit);
  }

  async getExecutionStats(ruleId?: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    running: number;
    pending: number;
    averageDuration?: number;
    successRate: number;
  }> {
    return await this.taskExecutionService.getExecutionStats(ruleId);
  }

  async startExecution(executionId: string): Promise<void> {
    await this.taskExecutionService.startExecution(executionId);
  }

  async completeExecution(executionId: string, result: any, matched: boolean, matchedCount?: number): Promise<void> {
    await this.taskExecutionService.completeExecution(executionId, result, matched, matchedCount);
  }

  async failExecution(executionId: string, error: string): Promise<void> {
    await this.taskExecutionService.failExecution(executionId, error);
  }

  async cancelExecution(executionId: string): Promise<void> {
    await this.taskExecutionService.cancelExecution(executionId);
  }

  async getExecutionById(executionId: string): Promise<TaskExecutionRecord | null> {
    return await this.taskExecutionService.getById(executionId);
  }

  async deleteExecution(executionId: string): Promise<boolean> {
    return await this.taskExecutionService.delete(executionId);
  }

  async cleanupOldRecords(daysToKeep: number = 30): Promise<number> {
    return await this.taskExecutionService.cleanupOldRecords(daysToKeep);
  }

  async getExecutionTimeline(ruleId: string, days: number = 7): Promise<{
    date: string;
    executions: number;
    completed: number;
    failed: number;
  }[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const executions = await this.taskExecutionService.query({
      ruleId,
      startDate,
      endDate,
      limit: 10000
    });

    const timeline = new Map<string, { executions: number; completed: number; failed: number }>();

    // Initialize timeline
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      timeline.set(dateStr, { executions: 0, completed: 0, failed: 0 });
    }

    // Aggregate data
    executions.executions.forEach(execution => {
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
      ...data
    }));
  }
}

export const taskExecutionManager = new TaskExecutionManager();