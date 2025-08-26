import { defineBackground } from '#imports';
import { infoFlowGetMessenger } from '@/services/InfoFlowGet/messageProtocol';
import { runInfoFlowGet } from '@/services/InfoFlowGet/runInfoFlowGet';
import { openExtensionDatabase, registerConfigsService } from '@/storage/indexdbAdapter';
import { openInfoFlowRulesDatabase, registerRulesService } from '@/storage/rulesService';

export default defineBackground(() => {
  infoFlowGetMessenger.onMessage('runInfoFlowGet', async (msg) => {
    return runInfoFlowGet(msg.data);
  });

  const db = openExtensionDatabase();
  registerConfigsService(db);

  const InfoFlowRulesDb = openInfoFlowRulesDatabase();
  registerRulesService(InfoFlowRulesDb);
});
