import { browser, createApp, createShadowRootUi, defineContentScript } from '#imports';
import '~/assets/tailwindcss.css';
import 'primeicons/primeicons.css';
import 'primevue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import App from './content/app.vue';
import { ConfirmationService, ToastService } from 'primevue';
import { runTaskMessageId, type runInfoFlowGet_task } from '@/services/InfoFlowGet/messageProtocol';

function setupMessageListener() {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === runTaskMessageId) {
      const task = message.data as runInfoFlowGet_task;
      console.log('[task]', task);
      execTask(task).then((res) => {
        sendResponse(res);
      });
      return true;
    }
  });
}

function createVueApp(container: Element) {
  const app = createApp(App);
  app.use(PrimeVue, {
    theme: {
      preset: Aura,
    },
  });
  app.use(ToastService);
  app.use(ConfirmationService);
  app.mount(container);
  return app;
}

async function setupUI(ctx: any) {
  const ui = await createShadowRootUi(ctx, {
    name: 'infoflow-ui',
    position: 'inline',
    anchor: 'body',
    onMount: createVueApp,
    onRemove: (app) => app?.unmount(),
  });
  ui.mount();
}

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    setupMessageListener();
    await setupUI(ctx);
  },
});

async function execTask(task: runInfoFlowGet_task) {
  const hrefs = [
    ...document
      .querySelectorAll('a')
      .values()
      .map((el) => el.href),
  ];
  console.log('[hrefs]', hrefs);
  return hrefs;
}
