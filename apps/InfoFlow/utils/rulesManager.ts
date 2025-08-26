import { getRulesService } from '../storage/rulesService';
import { taskGenerator } from '../utils/ruleTaskGenerator';
import { infoFlowGetMessenger } from '../services/InfoFlowGet/messageProtocol';
import type { Rule } from '../storage/rulesService';

export class RulesManager {
  private rulesService = getRulesService();

  async createRule(ruleData: {
    name: string;
    description: string;
    cron: string;
    taskConfig: any;
    tags?: string[];
    priority?: number;
  }): Promise<Rule> {
    const rule = await this.rulesService.create({
      ...ruleData,
      status: 'active'
    });

    // Start scheduling the rule
    await taskGenerator.scheduleRuleExecution(rule);
    
    return rule;
  }

  async getRules(options?: {
    page?: number;
    limit?: number;
    status?: 'active' | 'inactive' | 'paused';
    tags?: string[];
    search?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'lastExecutedAt' | 'priority' | 'name';
    sortOrder?: 'asc' | 'desc';
  }) {
    return await this.rulesService.query(options);
  }

  async updateRule(id: string, updates: Partial<Rule>): Promise<Rule | null> {
    const rule = await this.rulesService.update(id, updates);
    
    if (rule) {
      // Cancel existing scheduling and reschedule if active
      await taskGenerator.cancelRuleExecution(id);
      if (rule.status === 'active') {
        await taskGenerator.scheduleRuleExecution(rule);
      }
    }
    
    return rule;
  }

  async deleteRule(id: string): Promise<boolean> {
    // Cancel scheduling before deleting
    await taskGenerator.cancelRuleExecution(id);
    return await this.rulesService.delete(id);
  }

  async activateRule(id: string): Promise<Rule | null> {
    const rule = await this.updateRule(id, { status: 'active' });
    if (rule) {
      await taskGenerator.scheduleRuleExecution(rule);
    }
    return rule;
  }

  async pauseRule(id: string): Promise<Rule | null> {
    const rule = await this.updateRule(id, { status: 'paused' });
    if (rule) {
      await taskGenerator.cancelRuleExecution(id);
    }
    return rule;
  }

  async deactivateRule(id: string): Promise<Rule | null> {
    const rule = await this.updateRule(id, { status: 'inactive' });
    if (rule) {
      await taskGenerator.cancelRuleExecution(id);
    }
    return rule;
  }

  async getRuleStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    paused: number;
    totalExecutions: number;
  }> {
    const allRules = await this.rulesService.getAll();
    
    return {
      total: allRules.length,
      active: allRules.filter(r => r.status === 'active').length,
      inactive: allRules.filter(r => r.status === 'inactive').length,
      paused: allRules.filter(r => r.status === 'paused').length,
      totalExecutions: allRules.reduce((sum, r) => sum + r.executionCount, 0)
    };
  }

  async executeRule(ruleId: string): Promise<{
    success: boolean;
    message: string;
    result?: any;
  }> {
    try {
      const rule = await this.rulesService.getById(ruleId);
      if (!rule) {
        return { success: false, message: '规则不存在' };
      }

      const task = taskGenerator.generateTaskFromRule(rule);
      const res = await infoFlowGetMessenger.sendMessage('runInfoFlowGet', task);
      console.log('[executeRule res]', res);

      if (!res) {
        return { success: false, message: '执行返回结果为空' };
      }

      return {
        success: true,
        message: res.matched ? '执行成功' : '执行完成但未匹配到内容',
        result: res
      };
    } catch (error) {
      console.error('Failed to execute rule:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      return {
        success: false,
        message: `执行失败: ${errorMessage}`
      };
    }
  }
}

export const rulesManager = new RulesManager();

// Example usage:
/*
// Create a new rule
const newRule = await rulesManager.createRule({
  name: 'Daily Data Collection',
  description: 'Collect data from example.com every day at 9 AM',
  cron: '0 9 * * *',
  taskConfig: {
    url: 'https://example.com',
    dataCollection: [
      { type: 'css', selector: '.title' },
      { type: 'css', selector: '.content' }
    ]
  },
  tags: ['daily', 'data-collection'],
  priority: 1
});

// Get paginated rules
const rules = await rulesManager.getRules({
  page: 1,
  limit: 10,
  status: 'active',
  sortBy: 'priority',
  sortOrder: 'asc'
});

// Search rules
const searchResults = await rulesManager.getRules({
  search: 'data collection',
  limit: 20
});

// Update a rule
await rulesManager.updateRule(ruleId, {
  name: 'Updated Rule Name',
  cron: '0 10 * * *' // Change to 10 AM
});

// Delete a rule
await rulesManager.deleteRule(ruleId);

// Get statistics
const stats = await rulesManager.getRuleStats();
*/