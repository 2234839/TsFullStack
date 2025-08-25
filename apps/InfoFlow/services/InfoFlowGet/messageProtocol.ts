import { defineExtensionMessaging } from '@webext-core/messaging';

interface ProtocolMap {
  runInfoFlowGet(task: runInfoFlowGet_task): number;
}

export type runInfoFlowGet_task= { url: string }

export const infoFlowGetMessage = defineExtensionMessaging<ProtocolMap>();
