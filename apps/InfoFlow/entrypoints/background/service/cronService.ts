import { defineProxyService } from '@webext-core/proxy-service';
import { browser } from '#imports';
import { useWxtStorage } from '@/storage/storageUtil';
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

  // 存储相关函数
  const storage = useWxtStorage('local:cronService', {
    fallback: {
      extensionClosedAt: null as string | null,
    },
  });

  const storeExtensionCloseTime = async (): Promise<void> => {
    try {
      storage.value.extensionClosedAt = new Date().toISOString();
      console.log('[CronService] 已存储扩展关闭时间');
    } catch (error) {
      console.error('[CronService] 存储扩展关闭时间失败:', error);
    }
  };

  const getExtensionCloseTime = async (): Promise<Date | null> => {
    try {
      const closeTimeStr = storage.value.extensionClosedAt;
      if (closeTimeStr) {
        const closeTime = new Date(closeTimeStr);
        console.log('[CronService] 获取扩展关闭时间:', closeTime.toISOString());
        return closeTime;
      }
      return null;
    } catch (error) {
      console.error('[CronService] 获取扩展关闭时间失败:', error);
      return null;
    }
  };

  const clearExtensionCloseTime = async (): Promise<void> => {
    try {
      storage.value.extensionClosedAt = null;
      console.log('[CronService] 已清除扩展关闭时间');
    } catch (error) {
      console.error('[CronService] 清除扩展关闭时间失败:', error);
    }
  };

  // 注册扩展关闭事件
  if (browser.runtime?.onSuspend) {
    browser.runtime.onSuspend.addListener(async () => {
      await storeExtensionCloseTime();
    });
  }


  const scheduleRuleExecution = async (ruleId: string, timeBase?: Date): Promise<void> => {
    const rule = await getRulesService().getById(ruleId);
    if (!rule || rule.status !== 'active') return;

    // 检查是否已经存在相同时间基点的调度
    const existingJob = scheduledJobs.get(ruleId);
    if (existingJob && timeBase && existingJob.timeBase.getTime() === timeBase.getTime()) {
      console.log(`[CronService] 规则 ${rule.name} (${ruleId}) 已使用相同时间基点调度，跳过重复调度`);
      return;
    }

    // 使用规则的上次执行时间或提供的时间基点
    const baseTime = timeBase || rule.lastExecutedAt || new Date();
    console.log(`[CronService] 调度规则 ${rule.name} (${ruleId})，cron: ${rule.cron}，时间基点: ${baseTime.toISOString()}`);
    const nextExecution = calculateNextExecution(rule.cron, baseTime);
    if (!nextExecution) return;

    const delay = nextExecution.getTime() - Date.now();
    console.log(`[CronService] 规则 ${rule.name} (${ruleId}) 下次执行: ${nextExecution.toISOString()}，延迟: ${delay}ms`);
    // calculateNextExecution 已经处理了时间过去的情况，所以这里不需要再检查 delay <= 0

    // Cancel existing job if any
    await cancelRuleExecution(ruleId);

    const timeoutId = setTimeout(async () => {
      const executionStartTime = new Date();
      console.log(`[CronService] 执行规则 ${rule.name} (${ruleId})，时间: ${executionStartTime.toISOString()}`);
      await executeRuleLogic(
        rule,
        'scheduled',
        `Scheduled execution at ${executionStartTime.toISOString()}`,
      );

      // Reschedule for next run,使用本次执行时间作为新的时间基点
      const executionTime = new Date();
      console.log(`[CronService] 重新调度规则 ${rule.name} (${ruleId})，时间基点: ${executionTime.toISOString()}`);
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

    console.log(`[CronService] 已调度规则 ${rule.name} (${ruleId}) 在 ${nextExecution.toISOString()} 执行 (基点: ${baseTime.toISOString()})`);
  };

  const cancelRuleExecution = async (ruleId: string): Promise<void> => {
    const job = scheduledJobs.get(ruleId);
    if (job) {
      clearTimeout(job.timeoutId);
      scheduledJobs.delete(ruleId);
      console.log(`[CronService] 已取消规则 ${ruleId} 的调度`);
    }
  };

  const executeCompensationTasks = async (rules: Rule[]): Promise<void> => {
    console.log('[CronService] 检查补偿任务...');

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
          console.log(`[CronService] 执行补偿任务 ${rule.name} (${rule.id})`);
          await executeRuleLogic(
            rule,
            'scheduled',
            `Compensation execution at ${currentTime.toISOString()}`,
          );

          compensationCount++;

          // 更新规则的最后执行时间
          await getRulesService().updateNextExecution(rule.id, currentTime);

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
      console.warn(`[CronService] 规则 ${rule.name} (${rule.id}) 的上次执行时间在未来，跳过补偿`);
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
        console.log(`[CronService] 规则 ${rule.name} (${rule.id}) 距离上次执行已 ${timeSinceLastExecution}ms，超过 cron 周期 ${cronInterval}ms 的 1.5 倍，需要补偿`);
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
      console.log(`[CronService] 规则 ${rule.name} (${rule.id}) 在 ${startTime.toISOString()} 到 ${endTime.toISOString()} 期间错过了 ${expectedExecutions} 次执行`);
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
      console.error('计算预期执行次数时出错:', error);
      return 0;
    }
  };


  const startAllActiveRules = async (): Promise<void> => {
    console.log('[CronService] 启动所有活跃规则...');
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
        console.error(`[CronService] 调度规则 ${rule.name} (${rule.id}) 失败:`, error);
      }
    }

    console.log(`[CronService] 已启动 ${scheduledJobs.size} 个活跃规则`);
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