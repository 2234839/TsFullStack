import { browser, defineBackground } from '#imports';
import { infoFlowGetMessenger } from '@/services/InfoFlowGet/messageProtocol';
import { runInfoFlowGet } from '@/services/InfoFlowGet/runInfoFlowGet';
import {
  getConfigsService,
  openExtensionDatabase,
  registerConfigsService,
} from '@/storage/indexdbAdapter';

export default defineBackground(() => {
  infoFlowGetMessenger.onMessage('runInfoFlowGet', async (msg) => {
    console.log('[msg]', msg);
    return runInfoFlowGet(msg.data);
  });
  const db = openExtensionDatabase();

  /** 注册存储service */
  const _configsService = registerConfigsService(db);
  const cs = getConfigsService();
  cs.upsert({ data: '3333', key: '33333'  });
  cs.getAll().then((r) => {
    console.log('[r]', r);
  });
});
