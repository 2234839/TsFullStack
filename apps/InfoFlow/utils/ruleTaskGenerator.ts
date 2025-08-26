import type { runInfoFlowGet_task } from '@/services/InfoFlowGet/messageProtocol';
import { getRulesService } from '../storage/rulesService';
import type { Rule } from '../storage/rulesService';

export interface TaskGenerator {
  generateTaskFromRule(rule: Rule): runInfoFlowGet_task;
  scheduleRuleExecution(rule: Rule): Promise<void>;
  cancelRuleExecution(ruleId: string): Promise<void>;
}

export class RuleTaskGenerator implements TaskGenerator {
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();

  generateTaskFromRule(rule: Rule): runInfoFlowGet_task {
    const baseTask: runInfoFlowGet_task = {
      url: rule.taskConfig.url || '',
      timing: rule.taskConfig.timing,
      timeout: rule.taskConfig.timeout,
      dataCollection: rule.taskConfig.dataCollection,
    };

    return baseTask;
  }

  async scheduleRuleExecution(rule: Rule): Promise<void> {
    if (rule.status !== 'active') return;

    const nextExecution = this.calculateNextExecution(rule.cron);
    if (!nextExecution) return;

    const delay = nextExecution.getTime() - Date.now();
    if (delay <= 0) return;

    const timeoutId = setTimeout(async () => {
      await this.executeRule(rule);
      await this.scheduleRuleExecution(rule);
    }, delay);

    this.scheduledJobs.set(rule.id, timeoutId);

    const rulesService = getRulesService();
    await rulesService.updateNextExecution(rule.id, nextExecution);
  }

  async cancelRuleExecution(ruleId: string): Promise<void> {
    const timeoutId = this.scheduledJobs.get(ruleId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.scheduledJobs.delete(ruleId);
    }
  }

  private async executeRule(rule: Rule): Promise<void> {
  //  待实现
  }

  private calculateNextExecution(cronExpression: string): Date | null {
    try {
      const [minute, hour] = cronExpression.split(' ');

      const now = new Date();
      const next = new Date(now);

      next.setSeconds(0);
      next.setMilliseconds(0);

      if (minute !== '*') {
        next.setMinutes(parseInt(minute));
      }

      if (hour !== '*') {
        next.setHours(parseInt(hour));
      }

      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      return next;
    } catch (error) {
      console.error('Invalid cron expression:', cronExpression);
      return null;
    }
  }

  async startAllActiveRules(): Promise<void> {
    const rulesService = getRulesService();
    const activeRules = await rulesService.getActiveRules();

    for (const rule of activeRules) {
      await this.scheduleRuleExecution(rule);
    }
  }

  async stopAllScheduledRules(): Promise<void> {
    for (const [, timeoutId] of this.scheduledJobs) {
      clearTimeout(timeoutId);
    }
    this.scheduledJobs.clear();
  }
}

export const taskGenerator = new RuleTaskGenerator();