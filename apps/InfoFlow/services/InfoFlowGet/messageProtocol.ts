import { defineExtensionMessaging } from '@webext-core/messaging';
import { defineWindowMessaging } from '@webext-core/messaging/page';

interface ProtocolMap {
  runInfoFlowGet(task: runInfoFlowGet_task): TaskResult;
}


export interface TaskResult {
  url: string;
  title: string;
  timestamp: string;
  matched: boolean;
  message?: string;
  data?: any;
  collections?: Record<string, any[]>;
}

/**
 * 可以通过 infoFlowGetMessenger 发送 runInfoFlowGet 消息创建 task，最终会在在 content.ts 中通过 execTask 函数执行任务
 */
export type ExecutionTiming = 
  | { type: 'delay'; ms: number }
  | { type: 'waitForElement'; selector: string; delay?: number };

export type DataCollectionMethod = 
  | { type: 'css'; selector: string; attribute?: string }
  | { type: 'js'; code: string };

export type runInfoFlowGet_task = { 
  url: string;
  timing?: ExecutionTiming;
  timeout?: number;
  dataCollection?: DataCollectionMethod[];
};

export const infoFlowGetMessenger = defineExtensionMessaging<ProtocolMap>();
export const runTaskMessageId = 'runTaskMessageId';
