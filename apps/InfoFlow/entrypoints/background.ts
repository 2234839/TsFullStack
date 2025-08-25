import { browser, defineBackground } from '#imports';
import { infoFlowGetMessage } from '@/services/InfoFlowGet/messageProtocol';
import { runInfoFlowGet } from '@/services/InfoFlowGet/runInfoFlowGet';

export default defineBackground(async () => {
  infoFlowGetMessage.onMessage('runInfoFlowGet', async (msg) => {
    console.log('[msg]', msg);
    return runInfoFlowGet(msg.data);
  });
});
