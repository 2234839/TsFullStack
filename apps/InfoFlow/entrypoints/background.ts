import { browser, defineBackground } from '#imports';
import { infoFlowGetMessenger } from '@/services/InfoFlowGet/messageProtocol';
import { runInfoFlowGet } from '@/services/InfoFlowGet/runInfoFlowGet';

export default defineBackground(async () => {
  infoFlowGetMessenger.onMessage('runInfoFlowGet', async (msg) => {
    console.log('[msg]', msg);
    return runInfoFlowGet(msg.data);
  });
});
