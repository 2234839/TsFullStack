import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { defineProxyService } from '@webext-core/proxy-service';

interface ExtensionDatabaseSchema extends DBSchema {
  taskExecutions: {
    key: string;
    value: TaskExecutionRecord;
    indexes: {
      by_rule_id: string;
      by_created_at: number;
      by_status: string;
      by_rule_id_created_at: [string, number];
    };
  };
}

export type ExtensionDatabase = IDBPDatabase<ExtensionDatabaseSchema>;

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
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskExecutionQueryOptions {
  page?: number;
  limit?: number;
  ruleId?: string;
  status?: TaskExecutionRecord['status'];
  executionType?: TaskExecutionRecord['executionType'];
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

export function openInfoFlowTaskExecutionDatabase(): Promise<ExtensionDatabase> {
  return openDB<ExtensionDatabaseSchema>('infoFlow-task-executions', 1, {
    upgrade(database) {
      const executionsStore = database.createObjectStore('taskExecutions', {
        keyPath: 'id',
      });

      executionsStore.createIndex('by_rule_id', 'ruleId');
      executionsStore.createIndex('by_created_at', 'createdAt');
      executionsStore.createIndex('by_status', 'status');
      executionsStore.createIndex('by_rule_id_created_at', ['ruleId', 'createdAt']);
    },
  });
}

function createTaskExecutionService(_db: Promise<ExtensionDatabase>) {
  return {
    async create(record: Omit<TaskExecutionRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskExecutionRecord> {
      const db = await _db;
      const newRecord: TaskExecutionRecord = {
        id: crypto.randomUUID(),
        ...record,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.put('taskExecutions', newRecord);
      return newRecord;
    },

    async update(id: string, updates: Partial<TaskExecutionRecord>): Promise<TaskExecutionRecord | null> {
      const db = await _db;
      const existing = await db.get('taskExecutions', id);
      if (!existing) return null;

      const updatedRecord: TaskExecutionRecord = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };

      await db.put('taskExecutions', updatedRecord);
      return updatedRecord;
    },

    async delete(id: string): Promise<boolean> {
      const db = await _db;
      await db.delete('taskExecutions', id);
      return true;
    },

    async getById(id: string): Promise<TaskExecutionRecord | null> {
      const db = await _db;
      const result = await db.get('taskExecutions', id);
      return result || null;
    },

    async query(options: TaskExecutionQueryOptions = {}): Promise<PaginatedTaskExecutions> {
      const db = await _db;
      const {
        page = 1,
        limit = 20,
        ruleId,
        status,
        executionType,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      let executions: TaskExecutionRecord[] = [];

      if (ruleId) {
        executions = await db.getAllFromIndex('taskExecutions', 'by_rule_id', ruleId);
      } else if (status) {
        executions = await db.getAllFromIndex('taskExecutions', 'by_status', status);
      } else {
        executions = await db.getAll('taskExecutions');
      }

      // Apply filters
      let filteredExecutions = executions;

      if (executionType) {
        filteredExecutions = filteredExecutions.filter(exec => exec.executionType === executionType);
      }

      if (startDate) {
        filteredExecutions = filteredExecutions.filter(exec => exec.createdAt >= startDate);
      }

      if (endDate) {
        filteredExecutions = filteredExecutions.filter(exec => exec.createdAt <= endDate);
      }

      // Sort executions
      filteredExecutions.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];

        if (aValue instanceof Date) aValue = aValue.getTime();
        if (bValue instanceof Date) bValue = bValue.getTime();

        // Handle undefined values
        if (aValue === undefined || aValue === null) aValue = 0;
        if (bValue === undefined || bValue === null) bValue = 0;

        if (sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });

      // Apply pagination
      const total = filteredExecutions.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginatedExecutions = filteredExecutions.slice(offset, offset + limit);

      return {
        executions: paginatedExecutions,
        total,
        page,
        limit,
        totalPages
      };
    },

    async getByRuleId(ruleId: string, options?: Omit<TaskExecutionQueryOptions, 'ruleId'>): Promise<PaginatedTaskExecutions> {
      return await this.query({ ...options, ruleId });
    },

    async getRecentExecutions(ruleId?: string, limit: number = 10): Promise<TaskExecutionRecord[]> {
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
      const allExecutions = await this.query({ ruleId, limit: 10000 });
      const executions = allExecutions.executions;

      const completed = executions.filter(e => e.status === 'completed').length;
      const failed = executions.filter(e => e.status === 'failed').length;
      const running = executions.filter(e => e.status === 'running').length;
      const pending = executions.filter(e => e.status === 'pending').length;
      const total = executions.length;

      const successRate = total > 0 ? (completed / total) * 100 : 0;

      const completedWithDuration = executions.filter(e => e.status === 'completed' && e.duration !== undefined);
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
      const db = await _db;
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      
      let allExecutions = await db.getAll('taskExecutions');
      const oldExecutions = allExecutions.filter(exec => exec.createdAt < cutoffDate);
      
      for (const execution of oldExecutions) {
        await db.delete('taskExecutions', execution.id);
      }
      
      return oldExecutions.length;
    }
  };
}

export const [registerTaskExecutionService, getTaskExecutionService] = defineProxyService(
  'task-execution-service',
  createTaskExecutionService,
);