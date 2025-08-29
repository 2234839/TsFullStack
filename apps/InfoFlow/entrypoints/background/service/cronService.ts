import { defineProxyService } from '@webext-core/proxy-service';
import { browser } from '#imports';
import { useWxtStorage } from '@/storage/storageUtil';
import { getRulesService, type Rule } from './rulesService';
import { executeRuleLogic } from '@/utils/ruleTaskGenerator';

interface ScheduledJob {
  id: string;
  timeoutId: NodeJS.Timeout;
  nextExecution: Date;
  ruleId: string;
  timeBase: Date; // 时间基点，用于避免重复执行
}

function createCronService() {
  const scheduledJobs: Map<string, ScheduledJob> = new Map();

  // 存储相关函数
  const storage = useWxtStorage('local:cronService', {
    fallback: {
      extensionClosedAt: null as string | null,
    },
  });
  
  const storeExtensionCloseTime = async (): Promise<void> => {
    try {
      storage.value.extensionClosedAt = new Date().toISOString();
      console.log('[CronService] Stored extension close time');
    } catch (error) {
      console.error('[CronService] Failed to store extension close time:', error);
    }
  };

  const getExtensionCloseTime = async (): Promise<Date | null> => {
    try {
      const closeTimeStr = storage.value.extensionClosedAt;
      if (closeTimeStr) {
        const closeTime = new Date(closeTimeStr);
        console.log('[CronService] Retrieved extension close time:', closeTime.toISOString());
        return closeTime;
      }
      return null;
    } catch (error) {
      console.error('[CronService] Failed to get extension close time:', error);
      return null;
    }
  };

  const clearExtensionCloseTime = async (): Promise<void> => {
    try {
      storage.value.extensionClosedAt = null;
      console.log('[CronService] Cleared extension close time');
    } catch (error) {
      console.error('[CronService] Failed to clear extension close time:', error);
    }
  };

  // 注册扩展关闭事件
  if (browser.runtime?.onSuspend) {
    browser.runtime.onSuspend.addListener(async () => {
      await storeExtensionCloseTime();
    });
  }

  const getCronInterval = (cronExpression: string): number => {
    try {
      const [minute, hour] = cronExpression.split(' ');
      
      // 计算周期间隔（毫秒）
      if (hour === '*' && minute === '*') {
        // 每分钟执行
        return 60 * 1000;
      } else if (hour === '*') {
        // 每小时执行
        return 60 * 60 * 1000;
      } else if (minute === '*') {
        // 每天执行（每小时）
        return 60 * 60 * 1000;
      } else {
        // 每天执行（特定时间）
        return 24 * 60 * 60 * 1000;
      }
    } catch (error) {
      console.error('Error calculating cron interval:', error);
      // 默认按天计算
      return 24 * 60 * 60 * 1000;
    }
  };

  const calculateNextExecution = (cronExpression: string, timeBase?: Date): Date | null => {
    try {
      const [minute, hour] = cronExpression.split(' ');

      // 使用提供的时间基点，如果没有则使用当前时间
      const baseTime = timeBase || new Date();
      const next = new Date(baseTime);

      next.setSeconds(0);
      next.setMilliseconds(0);

      if (minute !== '*') {
        next.setMinutes(parseInt(minute));
      }

      if (hour !== '*') {
        next.setHours(parseInt(hour));
      }

      // 如果计算出的时间已经过去，则推迟到下一个周期
      const now = new Date();
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      return next;
    } catch (error) {
      console.error('Invalid cron expression:', cronExpression);
      return null;
    }
  };

  const scheduleRuleExecution = async (ruleId: string, timeBase?: Date): Promise<void> => {
    const rule = await getRulesService().getById(ruleId);
    if (!rule || rule.status !== 'active') return;

    // 检查是否已经存在相同时间基点的调度
    const existingJob = scheduledJobs.get(ruleId);
    if (existingJob && timeBase && existingJob.timeBase.getTime() === timeBase.getTime()) {
      console.log(`[CronService] Rule ${rule.name} (${ruleId}) already scheduled with the same time base, skipping duplicate`);
      return;
    }

    // 使用规则的上次执行时间或提供的时间基点
    const baseTime = timeBase || rule.lastExecutedAt || new Date();
    const nextExecution = calculateNextExecution(rule.cron, baseTime);
    if (!nextExecution) return;

    const delay = nextExecution.getTime() - Date.now();
    if (delay <= 0) return;

    // Cancel existing job if any
    await cancelRuleExecution(ruleId);

    const timeoutId = setTimeout(async () => {
      console.log(`[CronService] Executing rule ${rule.name} (${ruleId}) at ${new Date().toISOString()}`);
      await executeRuleLogic(
        rule,
        'scheduled',
        `Scheduled execution at ${new Date().toISOString()}`,
      );

      // Reschedule for next run,使用本次执行时间作为新的时间基点
      const executionTime = new Date();
      await scheduleRuleExecution(ruleId, executionTime);
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

    console.log(`[CronService] Scheduled rule ${rule.name} (${ruleId}) to run at ${nextExecution.toISOString()} (base: ${baseTime.toISOString()})`);
  };

  const cancelRuleExecution = async (ruleId: string): Promise<void> => {
    const job = scheduledJobs.get(ruleId);
    if (job) {
      clearTimeout(job.timeoutId);
      scheduledJobs.delete(ruleId);
      console.log(`[CronService] Cancelled scheduling for rule ${ruleId}`);
    }
  };

  const executeCompensationTasks = async (rules: Rule[]): Promise<void> => {
    console.log('[CronService] Checking for compensation tasks...');

    const currentTime = new Date();
    let compensationCount = 0;

    for (const rule of rules) {
      if (rule.status !== 'active') continue;

      // 获取规则的上次执行时间
      const lastExecutedAt = rule.lastExecutedAt;
      if (!lastExecutedAt) continue;

      // 检查是否需要补偿
      const shouldCompensate = await shouldExecuteCompensation(rule, currentTime);

      if (shouldCompensate) {
        try {
          console.log(`[CronService] Executing compensation for rule ${rule.name} (${rule.id})`);

          // 执行补偿任务
          await executeRuleLogic(
            rule,
            'scheduled',
            `Compensation execution at ${currentTime.toISOString()}`,
          );

          compensationCount++;

          // 更新规则的最后执行时间
          await getRulesService().updateNextExecution(rule.id, currentTime);

        } catch (error) {
          console.error(`[CronService] Failed to execute compensation for rule ${rule.name} (${rule.id}):`, error);
        }
      }
    }

    if (compensationCount > 0) {
      console.log(`[CronService] Executed ${compensationCount} compensation tasks`);
    } else {
      console.log('[CronService] No compensation tasks needed');
    }
  };

  const shouldExecuteCompensation = async (
    rule: Rule,
    currentTime: Date,
  ): Promise<boolean> => {
    const { lastExecutedAt } = rule;
    
    // 如果没有上次执行时间，不需要补偿
    if (!lastExecutedAt) {
      return false;
    }
    
    // 如果上次执行时间在未来，说明数据有问题，跳过
    if (lastExecutedAt > currentTime) {
      console.warn(`[CronService] Rule ${rule.name} (${rule.id}) has lastExecutedAt in the future, skipping compensation`);
      return false;
    }

    // 获取扩展关闭时间
    const extensionClosedAt = await getExtensionCloseTime();
    
    if (extensionClosedAt) {
      // 如果有关闭时间，计算关闭期间是否错过了执行
      return await shouldCompensateDuringPeriod(rule, extensionClosedAt, currentTime);
    } else {
      // 如果没有关闭时间，基于时间窗口判断
      const timeSinceLastExecution = currentTime.getTime() - lastExecutedAt.getTime();
      const cronInterval = getCronInterval(rule.cron);
      
      // 如果超过了一个周期的1.5倍，说明可能错过了执行
      const shouldCompensate = timeSinceLastExecution > cronInterval * 1.5;
      
      if (shouldCompensate) {
        console.log(`[CronService] Rule ${rule.name} (${rule.id}) time since last execution (${timeSinceLastExecution}ms) exceeds 1.5x cron interval (${cronInterval}ms), needs compensation`);
      }
      
      return shouldCompensate;
    }
  };

  const shouldCompensateDuringPeriod = async (
    rule: Rule,
    startTime: Date,
    endTime: Date,
  ): Promise<boolean> => {
    const { cron, lastExecutedAt } = rule;
    
    // 如果没有上次执行时间，不需要补偿
    if (!lastExecutedAt) {
      return false;
    }
    
    // 计算在指定时间段内应该执行多少次
    const expectedExecutions = calculateExpectedExecutions(cron, startTime, endTime, lastExecutedAt);
    
    if (expectedExecutions > 0) {
      console.log(`[CronService] Rule ${rule.name} (${rule.id}) missed ${expectedExecutions} executions during period from ${startTime.toISOString()} to ${endTime.toISOString()}`);
      return true;
    }
    
    return false;
  };

  const calculateExpectedExecutions = (
    cronExpression: string,
    startTime: Date,
    endTime: Date,
    lastExecutedBeforeStart: Date,
  ): number => {
    try {
      const [minute, hour] = cronExpression.split(' ');
      let executionCount = 0;
      let checkTime = new Date(startTime);
      
      // 重置时间为整点
      checkTime.setSeconds(0);
      checkTime.setMilliseconds(0);
      
      // 如果是分钟级别，需要特殊处理
      if (minute === '*' && hour === '*') {
        // 每分钟执行
        const minutesDiff = Math.floor((endTime.getTime() - startTime.getTime()) / (60 * 1000));
        return minutesDiff > 0 ? 1 : 0; // 最多补偿一次
      }
      
      // 遍历时间段内的每一天
      while (checkTime <= endTime) {
        // 设置执行时间
        if (minute !== '*') {
          checkTime.setMinutes(parseInt(minute));
        }
        
        if (hour !== '*') {
          checkTime.setHours(parseInt(hour));
        }
        
        // 检查这个时间点是否在时间段内，并且是在上次执行之后
        if (checkTime >= startTime && 
            checkTime <= endTime && 
            checkTime > lastExecutedBeforeStart) {
          executionCount++;
        }
        
        // 移动到下一天
        checkTime.setDate(checkTime.getDate() + 1);
        checkTime.setHours(0);
        checkTime.setMinutes(0);
      }
      
      return executionCount;
    } catch (error) {
      console.error('Error calculating expected executions:', error);
      return 0;
    }
  };

  
  const startAllActiveRules = async (): Promise<void> => {
    console.log('[CronService] Starting all active rules...');
    const activeRules = await getRulesService().getActiveRules();

    // 先执行补偿机制
    await executeCompensationTasks(activeRules);

    // 清理扩展关闭时间（因为已经处理了补偿）
    await clearExtensionCloseTime();

    // 然后开始正常调度
    for (const rule of activeRules) {
      try {
        await scheduleRuleExecution(rule.id);
      } catch (error) {
        console.error(`[CronService] Failed to schedule rule ${rule.name} (${rule.id}):`, error);
      }
    }

    console.log(`[CronService] Started ${scheduledJobs.size} active rules`);
  };

  const reinitializeCrons = async (): Promise<void> => {
    console.log('[CronService] Reinitializing all crons...');

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
        console.error(`[CronService] Failed to reschedule rule ${rule.name} (${rule.id}):`, error);
      }
    }

    console.log(`[CronService] Cron reinitialization completed, rescheduled ${activeRules.length} rules`);
  };

  const stopAllScheduledRules = async (): Promise<void> => {
    console.log('[CronService] Stopping all scheduled rules...');
    for (const [ruleId, job] of scheduledJobs) {
      clearTimeout(job.timeoutId);
      console.log(`[CronService] Stopped rule ${ruleId}`);
    }
    scheduledJobs.clear();
    console.log('[CronService] All scheduled rules stopped');
  };

  const getScheduledJobs = (): Array<{
    ruleId: string;
    nextExecution: Date;
    timeUntilExecution: number;
  }> => {
    return Array.from(scheduledJobs.values()).map(job => ({
      ruleId: job.ruleId,
      nextExecution: job.nextExecution,
      timeUntilExecution: job.nextExecution.getTime() - Date.now(),
    }));
  };

  const getScheduledJob = (ruleId: string): {
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
      if (minute !== '*' && (isNaN(parseInt(minute)) || parseInt(minute) < 0 || parseInt(minute) > 59)) {
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