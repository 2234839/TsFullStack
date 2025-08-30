import type { runInfoFlowGet_task } from '@/services/InfoFlowGet/messageProtocol';
import { getRulesService } from '../entrypoints/background/service/rulesService';
import { getTaskExecutionService } from '../entrypoints/background/service/taskExecutionService';
import type { Rule } from '../entrypoints/background/service/rulesService';
import { runInfoFlowGet } from '@/services/InfoFlowGet/runInfoFlowGet';
import { browser } from '#imports';
import { EVENT_TYPES } from '../constants/events';

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
      browser.runtime.sendMessage({
        type: EVENT_TYPES.RULE_EXECUTION_COMPLETED,
        payload: {
          ruleId,
          executionId,
          timestamp: new Date().toISOString(),
        },
      }).catch(error => {
        console.warn('[RuleTaskGenerator] Failed to send execution completed event:', error);
      });
    }
  } catch (error) {
    console.error('[RuleTaskGenerator] Error sending execution completed event:', error);
  }
}
