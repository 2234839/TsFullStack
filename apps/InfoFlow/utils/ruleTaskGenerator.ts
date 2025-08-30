import type { runInfoFlowGet_task, TaskResult } from '@/services/InfoFlowGet/messageProtocol';
import { getRulesService } from '../entrypoints/background/service/rulesService';
import { getTaskExecutionService } from '../entrypoints/background/service/taskExecutionService';
import type { Rule } from '../entrypoints/background/service/rulesService';
import { runInfoFlowGet } from '@/services/InfoFlowGet/runInfoFlowGet';
import { browser } from '#imports';
import { EVENT_TYPES } from '../constants/events';
import { useInfoFlowConfig } from '../storage/config';
import { getExecutionWithChanges, checkIfNoAdditions } from './changeDetection';


// 处理自动已读逻辑
async function handleAutoRead(
  ruleId: string,
  currentExecutionId: string,
  currentResult: TaskResult,
): Promise<void> {
  try {
    // 获取上一次成功的执行结果（排除当前执行）
    const taskExecutionService = getTaskExecutionService();
    const previousExecution = await taskExecutionService.getPreviousSuccessfulExecution(ruleId, currentExecutionId);

    // 如果没有上一次执行结果，不需要自动已读
    if (!previousExecution) {
      console.log(`[AutoRead] 规则 ${ruleId} 没有上一次执行结果，跳过自动已读`);
      return;
    }

    const lastResult = previousExecution.result;

    // 计算两次执行结果的变化，判断是否有新增项
    const executionWithChanges = getExecutionWithChanges(
      { result: currentResult },
      { result: lastResult }
    );

    const hasNoAdditions = checkIfNoAdditions(executionWithChanges);

    if (hasNoAdditions) {
      console.log(`[AutoRead] 规则 ${ruleId} 执行结果没有新增项，自动标记为已读`);
      await getTaskExecutionService().markAsRead(currentExecutionId);
    } else {
      console.log(`[AutoRead] 规则 ${ruleId} 执行结果有新增项，保持未读状态`);
    }
  } catch (error) {
    console.error('[AutoRead] 自动已读处理失败:', error);
  }
}


// 公共的规则执行逻辑
export async function executeRuleLogic(
  rule: Rule,
  executionType: 'manual' | 'scheduled' | 'triggered' = 'manual',
  triggerInfo?: string,
): Promise<{
  success: boolean;
  message: string;
  result?: any;
  executionId?: string;
}> {
  let executionId: string | undefined;
  /** 这个真实值的加载是异步的，所以需要放在最前面，确保到需要它的值的时候已经加载好了 */
  const config = useInfoFlowConfig();

  try {
    // Create execution record
    const executionRecord = await getTaskExecutionService().createExecutionRecord(
      rule.id,
      rule.name,
      executionType,
      triggerInfo,
    );
    executionId = executionRecord.id;

    // Start execution
    await getTaskExecutionService().startExecution(executionId);

    const task = taskGenerator.generateTaskFromRule(rule);
    console.log('[task]', task);
    const res = await runInfoFlowGet(task);
    console.log('[executeRule res]', res);

    if (!res) {
      await getTaskExecutionService().failExecution(executionId, '执行返回结果为空');
      return { success: false, message: '执行返回结果为空', executionId };
    }

    // Complete execution with result
    await getTaskExecutionService().completeExecution(executionId, res, res.matched ? 1 : 0);

    // Update rule execution count (this also updates lastExecutedAt)
    await getRulesService().incrementExecutionCount(rule.id);

    // 这里如果为false 的话，有可能是值还没加载完毕
    if (config.value.autoMarkAsRead) {
      await handleAutoRead(rule.id, executionId, res);
    }

    // 发送任务完成事件通知前端
    sendRuleExecutionCompletedEvent(rule.id, executionId);

    return {
      success: true,
      message: res.matched === 1 ? '执行成功' : '执行完成但未匹配到内容',
      result: res,
      executionId,
    };
  } catch (error) {
    console.error('Failed to execute rule:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';

    if (executionId) {
      await getTaskExecutionService().failExecution(executionId, errorMessage);
    }

    return {
      success: false,
      message: `执行失败: ${errorMessage}`,
      executionId,
    };
  }
}

export interface TaskGenerator {
  generateTaskFromRule(rule: Rule): runInfoFlowGet_task;
}

export class RuleTaskGenerator implements TaskGenerator {
  generateTaskFromRule(rule: Rule): runInfoFlowGet_task {
    const baseTask: runInfoFlowGet_task = {
      url: rule.taskConfig.url || '',
      timing: rule.taskConfig.timing,
      timeout: rule.taskConfig.timeout,
      dataCollection: rule.taskConfig.dataCollection,
    };

    return baseTask;
  }
}

export const taskGenerator = new RuleTaskGenerator();

// 发送规则执行完成事件到前端
function sendRuleExecutionCompletedEvent(ruleId: string, executionId: string) {
  try {
    // 发送消息到所有前端页面
    if (browser.runtime) {
      browser.runtime
        .sendMessage({
          type: EVENT_TYPES.RULE_EXECUTION_COMPLETED,
          payload: {
            ruleId,
            executionId,
            timestamp: new Date().toISOString(),
          },
        })
        .catch((error) => {
          console.warn('[RuleTaskGenerator] Failed to send execution completed event:', error);
        });
    }
  } catch (error) {
    console.error('[RuleTaskGenerator] Error sending execution completed event:', error);
  }
}
