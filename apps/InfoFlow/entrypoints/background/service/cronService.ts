import { defineProxyService } from '@webext-core/proxy-service';
import { getRulesService, type Rule } from './rulesService';
import { executeRuleLogic } from '@/utils/ruleTaskGenerator';
import { calculateNextExecution, getCronInterval } from '@/utils/cronUtils';

interface ScheduledJob {
  id: string;
  timeoutId: NodeJS.Timeout;
  nextExecution: Date;
  ruleId: string;
  timeBase: Date; // 时间基点，用于避免重复执行
}

function createCronService() {
  const scheduledJobs: Map<string, ScheduledJob> = new Map();

  const scheduleRuleExecution = async (ruleId: string, timeBase?: Date): Promise<void> => {
    const rule = await getRulesService().getById(ruleId);
    if (!rule || rule.status !== 'active') return;

    // 检查是否已经存在相同时间基点的调度
    const existingJob = scheduledJobs.get(ruleId);
    if (existingJob && timeBase && existingJob.timeBase.getTime() === timeBase.getTime()) {
      console.log(
        `[CronService] 规则 ${rule.name} (${ruleId}) 已使用相同时间基点调度，跳过重复调度`,
      );
      return;
    }

    // 使用规则的上次执行时间或提供的时间基点
    const baseTime = timeBase || rule.lastExecutedAt || new Date();
    console.log(
      `[CronService] 调度规则 ${rule.name} (${ruleId})，cron: ${
        rule.cron
      }，时间基点: ${baseTime.toISOString()}`,
    );
    const nextExecution = calculateNextExecution(rule.cron, baseTime);
    if (!nextExecution) return;

    const delay = nextExecution.getTime() - Date.now();
    const now = Date.now();
    console.log(
      `[CronService] 规则 ${
        rule.name
      } (${ruleId}) 下次执行: ${nextExecution.toISOString()}，当前时间: ${new Date(
        now,
      ).toISOString()}，延迟: ${delay}ms`,
    );

    // 如果延迟为负数或小于1000ms，说明计算有问题，跳过调度
    if (delay < 1000) {
      console.warn(
        `[CronService] 规则 ${rule.name} (${ruleId}) 的下次执行时间有问题 (${delay}ms)，跳过调度`,
      );
      return;
    }

    // 双重检查：确保下次执行时间确实在未来
    if (nextExecution.getTime() <= now) {
      console.warn(
        `[CronService] 规则 ${
          rule.name
        } (${ruleId}) 的下次执行时间 ${nextExecution.toISOString()} 不在未来，跳过调度`,
      );
      return;
    }

    // Cancel existing job if any
    await cancelRuleExecution(ruleId);

    console.log(
      `[CronService] 创建 setTimeout，延迟 ${delay}ms，预计执行时间: ${new Date(
        now + delay,
      ).toISOString()}`,
    );
    const timeoutId = setTimeout(async () => {
      const executionStartTime = new Date();
      const expectedTime = nextExecution.getTime();
      const actualTime = executionStartTime.getTime();
      const timeDiff = Math.abs(actualTime - expectedTime);

      console.log(
        `[CronService] setTimeout 触发执行规则 ${
          rule.name
        } (${ruleId})，时间: ${executionStartTime.toISOString()}，预计时间: ${nextExecution.toISOString()}，时间差: ${timeDiff}ms`,
      );

      // 如果执行时间与预期时间相差超过5秒，说明可能有问题，进行补偿执行
      let isCompensation = false;
      if (timeDiff > 5000) {
        console.warn(
          `[CronService] 规则 ${rule.name} (${ruleId}) 执行时间与预期相差 ${timeDiff}ms，进行补偿执行`,
        );

        // 计算错过的执行次数，如果超过阈值则只执行一次
        const cronInterval = getCronInterval(rule.cron);
        const missedExecutions = Math.floor(timeDiff / cronInterval);

        console.log(
          `[CronService] 规则 ${rule.name} (${ruleId}) 错过了大约 ${missedExecutions} 次执行，cron间隔: ${cronInterval}ms`,
        );

        // 如果错过了多次执行，只执行一次补偿（避免过度执行）
        if (missedExecutions > 1) {
          console.log(`[CronService] 规则 ${rule.name} (${ruleId}) 错过了多次执行，将执行一次补偿`);
        }

        isCompensation = true;
      }

      await executeRuleLogic(
        rule,
        'scheduled',
        `Scheduled execution at ${executionStartTime.toISOString()}`,
      );

      // Reschedule for next run
      // 如果是补偿执行，使用预期的执行时间作为时间基点，避免无限循环
      // 如果是正常执行，使用本次执行时间作为时间基点
      const timeBase = isCompensation ? nextExecution : executionStartTime;
      console.log(
        `[CronService] 重新调度规则 ${
          rule.name
        } (${ruleId})，时间基点: ${timeBase.toISOString()}，${
          isCompensation ? '补偿执行模式' : '正常执行模式'
        }`,
      );

      await scheduleRuleExecution(ruleId, timeBase);
    }, delay);

    const job: ScheduledJob = {
      id: ruleId,
      timeoutId,
      nextExecution,
      ruleId,
      timeBase: baseTime,
    };

    scheduledJobs.set(ruleId, job);

    // Update next execution time in database
    await getRulesService().updateNextExecution(ruleId, nextExecution);

    console.log(
      `[CronService] 已调度规则 ${
        rule.name
      } (${ruleId}) 在 ${nextExecution.toISOString()} 执行 (基点: ${baseTime.toISOString()})`,
    );
  };

  const cancelRuleExecution = async (ruleId: string): Promise<void> => {
    const job = scheduledJobs.get(ruleId);
    if (job) {
      clearTimeout(job.timeoutId);
      scheduledJobs.delete(ruleId);
      console.log(`[CronService] 已取消规则 ${ruleId} 的调度`);
    }
  };

  const startAllActiveRules = async (): Promise<void> => {
    console.log('[CronService] 启动所有活跃规则...');
    const activeRules = await getRulesService().getActiveRules();

    // 执行补偿机制
    await executeCompensationTasks(activeRules);

    // 开始正常调度
    for (const rule of activeRules) {
      try {
        await scheduleRuleExecution(rule.id);
      } catch (error) {
        console.error(`[CronService] 调度规则 ${rule.name} (${rule.id}) 失败:`, error);
      }
    }

    console.log(`[CronService] 已启动 ${scheduledJobs.size} 个活跃规则`);
  };

  const executeCompensationTasks = async (rules: Rule[]): Promise<void> => {
    console.log('[CronService] 检查补偿任务...');

    const currentTime = new Date();
    let compensationCount = 0;

    for (const rule of rules) {
      if (rule.status !== 'active') continue;

      // 检查是否需要补偿
      const shouldCompensate = shouldCompensateForRule(rule, currentTime);

      if (shouldCompensate) {
        try {
          console.log(`[CronService] 执行补偿任务 ${rule.name} (${rule.id})`);
          await executeRuleLogic(
            rule,
            'scheduled',
            `Compensation execution at ${currentTime.toISOString()}`,
          );

          compensationCount++;
        } catch (error) {
          console.error(`[CronService] 执行规则 ${rule.name} (${rule.id}) 补偿任务失败: `, error);
        }
      }
    }

    if (compensationCount > 0) {
      console.log(`[CronService] 已执行 ${compensationCount} 个补偿任务`);
    } else {
      console.log('[CronService] 无需执行补偿任务');
    }
  };

  const shouldCompensateForRule = (rule: Rule, currentTime: Date): boolean => {
    const { cron, lastExecutedAt } = rule;

    // 如果没有上次执行时间，说明是新规则或从未执行过，需要补偿
    if (!lastExecutedAt) {
      return true;
    }

    // 计算从上次执行时间开始的下一个执行时间
    const nextExecutionAfterLast = calculateNextExecution(cron, lastExecutedAt);
    if (!nextExecutionAfterLast) {
      return false;
    }

    // 如果下一个执行时间在当前时间之前，说明需要补偿
    // 这样就简单直接地判断是否错过了执行
    return nextExecutionAfterLast < currentTime;
  };

  const reinitializeCrons = async (): Promise<void> => {
    console.log('[CronService] 重新初始化所有 cron 任务...');

    // 获取当前所有活跃规则
    const activeRules = await getRulesService().getActiveRules();

    // 为每个规则记录当前的时间基点
    const currentTime = new Date();

    // 先停止所有现有的调度
    await stopAllScheduledRules();

    // 重新调度所有活跃规则，使用相同的时间基点避免重复执行
    for (const rule of activeRules) {
      try {
        // 使用当前时间作为统一的时间基点
        await scheduleRuleExecution(rule.id, currentTime);
      } catch (error) {
        console.error(`[CronService] 重新调度规则 ${rule.name} (${rule.id}) 失败:`, error);
      }
    }

    console.log(`[CronService] Cron 重新初始化完成，已重新调度 ${activeRules.length} 个规则`);
  };

  const stopAllScheduledRules = async (): Promise<void> => {
    console.log('[CronService] 停止所有已调度的规则...');
    for (const [ruleId, job] of scheduledJobs) {
      clearTimeout(job.timeoutId);
      console.log(`[CronService] 已停止规则 ${ruleId}`);
    }
    scheduledJobs.clear();
    console.log('[CronService] 所有已调度的规则已停止');
  };

  const getScheduledJobs = (): Array<{
    ruleId: string;
    nextExecution: Date;
    timeUntilExecution: number;
  }> => {
    return Array.from(scheduledJobs.values()).map((job) => ({
      ruleId: job.ruleId,
      nextExecution: job.nextExecution,
      timeUntilExecution: job.nextExecution.getTime() - Date.now(),
    }));
  };

  const getScheduledJob = (
    ruleId: string,
  ): {
    ruleId: string;
    nextExecution: Date;
    timeUntilExecution: number;
  } | null => {
    const job = scheduledJobs.get(ruleId);
    if (!job) return null;

    return {
      ruleId: job.ruleId,
      nextExecution: job.nextExecution,
      timeUntilExecution: job.nextExecution.getTime() - Date.now(),
    };
  };

  const validateCronExpression = (cronExpression: string): boolean => {
    try {
      const [minute, hour] = cronExpression.split(' ');

      // Validate minute
      if (
        minute !== '*' &&
        (isNaN(parseInt(minute)) || parseInt(minute) < 0 || parseInt(minute) > 59)
      ) {
        return false;
      }

      // Validate hour
      if (hour !== '*' && (isNaN(parseInt(hour)) || parseInt(hour) < 0 || parseInt(hour) > 23)) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  };

  const getNextExecutionTime = (cronExpression: string): Date | null => {
    return calculateNextExecution(cronExpression);
  };

  const getServiceStatus = (): {
    totalScheduledJobs: number;
    scheduledJobs: Array<{
      ruleId: string;
      nextExecution: Date;
      timeUntilExecution: number;
    }>;
  } => {
    return {
      totalScheduledJobs: scheduledJobs.size,
      scheduledJobs: getScheduledJobs(),
    };
  };

  return {
    scheduleRuleExecution,
    cancelRuleExecution,
    startAllActiveRules,
    stopAllScheduledRules,
    reinitializeCrons,
    getScheduledJobs,
    getScheduledJob,
    validateCronExpression,
    getNextExecutionTime,
    getServiceStatus,
  };
}

export const [registerCronService, getCronService] = defineProxyService(
  'cron-service',
  createCronService,
);

export type CronService = ReturnType<typeof createCronService>;
