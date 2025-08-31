
export interface CollectionItem {
  type: 'text' | 'html' | 'attribute' | 'js' | 'error';
  selector?: string;
  attribute?: string;
  value: any;
  timestamp: string;
}

export interface CollectionResult {
  items: CollectionItem[];
  timestamp: string;
  executionTime: number;
}

export interface TaskResult {
  url: string;
  title: string;
  timestamp: string;
  matched: 0 | 1;
  message?: string;
  data?: any;
  collections?: Record<string, CollectionResult>;
}

/**
 * 可以通过 infoFlowGetMessenger 发送 runInfoFlowGet 消息创建 task，最终会在在 content.ts 中通过 execTask 函数执行任务
 */
export type ExecutionTiming =
  | { type: 'delay'; ms: number }
  | { type: 'waitForElement'; selector: string; delay?: number };

export type DataCollectionMethod =
  | {
      type: 'css';
      selector: string;
      attribute?: string;
    }
  | {
      type: 'js';
      code: string;
    };

export type runInfoFlowGet_task = {
  url: string;
  timing?: ExecutionTiming;
  timeout?: number;
  dataCollection?: DataCollectionMethod[];
};

export const runTaskMessageId = 'runTaskMessageId';
export const contentScriptReadyMessageId = 'contentScriptReadyMessageId';
