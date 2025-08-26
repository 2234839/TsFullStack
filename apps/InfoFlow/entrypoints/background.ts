import { browser, defineBackground } from '#imports';
import { infoFlowGetMessenger } from '@/services/InfoFlowGet/messageProtocol';
import { runInfoFlowGet } from '@/services/InfoFlowGet/runInfoFlowGet';
import { registerConfigsService } from '@/storage/indexdbAdapter';
import { registerRulesService } from '@/storage/rulesService';
import {
  registerTaskExecutionService,
} from '@/storage/taskExecutionService';

export default defineBackground(() => {


  infoFlowGetMessenger.onMessage('runInfoFlowGet', async (msg) => {
    return runInfoFlowGet(msg.data);
  });

  registerConfigsService();
  registerRulesService();
  registerTaskExecutionService();
});
