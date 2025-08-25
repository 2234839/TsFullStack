import { defineExtensionMessaging } from '@webext-core/messaging';
import { defineWindowMessaging } from '@webext-core/messaging/page';

interface ProtocolMap {
  runInfoFlowGet(task: runInfoFlowGet_task): number;
}

export type runInfoFlowGet_task = { url: string };

export const infoFlowGetMessenger = defineExtensionMessaging<ProtocolMap>();
export const runTaskMessageId = 'runTaskMessageId';
