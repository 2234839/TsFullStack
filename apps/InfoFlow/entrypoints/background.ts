import { defineBackground } from '#imports';
import { infoFlowGetMessenger } from '@/services/InfoFlowGet/messageProtocol';
import { runInfoFlowGet } from '@/services/InfoFlowGet/runInfoFlowGet';
import { openExtensionDatabase, registerConfigsService } from '@/storage/indexdbAdapter';
import { openInfoFlowRulesDatabase, registerRulesService } from '@/storage/rulesService';
import {
  openInfoFlowTaskExecutionDatabase,
  registerTaskExecutionService,
} from '@/storage/taskExecutionService';

export default defineBackground(() => {
  infoFlowGetMessenger.onMessage('runInfoFlowGet', async (msg) => {
    return runInfoFlowGet(msg.data);
  });

  const db = openExtensionDatabase();
  registerConfigsService(db);

  const InfoFlowRulesDB = openInfoFlowRulesDatabase();
  registerRulesService(InfoFlowRulesDB);

  const taskDB = openInfoFlowTaskExecutionDatabase();
  registerTaskExecutionService(taskDB);
});
