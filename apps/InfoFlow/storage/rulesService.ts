import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { defineProxyService } from '@webext-core/proxy-service';

interface ExtensionDatabaseSchema extends DBSchema {
  rules: {
    key: string;
    value: Rule;
    indexes: {
      by_status: string;
      by_created_at: number;
    };
  };
}

export type ExtensionDatabase = IDBPDatabase<ExtensionDatabaseSchema>;

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

export interface RuleQueryOptions {
  page?: number;
  limit?: number;
  status?: Rule['status'];
  tags?: string[];
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'lastExecutedAt' | 'priority' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedRules {
  rules: Rule[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function openInfoFlowRulesDatabase(): Promise<ExtensionDatabase> {
  return openDB<ExtensionDatabaseSchema>('infoFlow-rules', 1, {
    upgrade(database) {
      const rulesStore = database.createObjectStore('rules', {
        keyPath: 'id',
      });

      rulesStore.createIndex('by_status', 'status');
      rulesStore.createIndex('by_created_at', 'createdAt');
    },
  });
}

function createRulesService(_db: Promise<ExtensionDatabase>) {
  return {
    async create(rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<Rule> {
      const db = await _db;
      const newRule: Rule = {
        id: crypto.randomUUID(),
        ...rule,
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
      };

      await db.put('rules', newRule);
      return newRule;
    },

    async update(id: string, updates: Partial<Rule>): Promise<Rule | null> {
      const db = await _db;
      const existing = await db.get('rules', id);
      if (!existing) return null;

      const updatedRule: Rule = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };

      await db.put('rules', updatedRule);
      return updatedRule;
    },

    async delete(id: string): Promise<boolean> {
      const db = await _db;
      await db.delete('rules', id);
      return true;
    },

    async getById(id: string): Promise<Rule | null> {
      const db = await _db;
      const result = await db.get('rules', id);
      return result || null;
    },

    async query(options: RuleQueryOptions = {}): Promise<PaginatedRules> {
      const db = await _db;
      const {
        page = 1,
        limit = 20,
        status,
        tags,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      let rules: Rule[] = [];

      if (status) {
        rules = await db.getAllFromIndex('rules', 'by_status', status);
      } else {
        rules = await db.getAll('rules');
      }

      // Apply filters
      let filteredRules = rules;

      if (tags && tags.length > 0) {
        filteredRules = filteredRules.filter(rule =>
          rule.tags && rule.tags.some(tag => tags.includes(tag))
        );
      }

      if (search) {
        const searchLower = search.toLowerCase();
        filteredRules = filteredRules.filter(rule =>
          rule.name.toLowerCase().includes(searchLower) ||
          rule.description.toLowerCase().includes(searchLower)
        );
      }

      // Sort rules
      filteredRules.sort((a, b) => {
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
      const total = filteredRules.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginatedRules = filteredRules.slice(offset, offset + limit);

      return {
        rules: paginatedRules,
        total,
        page,
        limit,
        totalPages
      };
    },

    async getAll(): Promise<Rule[]> {
      const db = await _db;
      return await db.getAll('rules');
    },

    async getActiveRules(): Promise<Rule[]> {
      const db = await _db;
      return await db.getAllFromIndex('rules', 'by_status', 'active');
    },

    async incrementExecutionCount(id: string): Promise<void> {
      const rule = await this.getById(id);
      if (rule) {
        await this.update(id, {
          executionCount: rule.executionCount + 1,
          lastExecutedAt: new Date()
        });
      }
    },

    async updateNextExecution(id: string, nextExecutionAt: Date): Promise<void> {
      await this.update(id, { nextExecutionAt });
    }
  };
}

export const [registerRulesService, getRulesService] = defineProxyService(
  'rules-service',
  createRulesService,
);