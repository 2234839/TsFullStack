import { defineExtensionMessaging } from '@webext-core/messaging';
import { defineWindowMessaging } from '@webext-core/messaging/page';

interface ProtocolMap {
  runInfoFlowGet(task: runInfoFlowGet_task): number;
}

/**
 * 可以通过 infoFlowGetMessenger 发送 runInfoFlowGet 消息创建 task，最终会在在 content.ts 中通过 execTask 函数执行任务
 */
export type runInfoFlowGet_task = { url: string };

export const infoFlowGetMessenger = defineExtensionMessaging<ProtocolMap>();
export const runTaskMessageId = 'runTaskMessageId';
