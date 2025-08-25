import { browser, createApp, createShadowRootUi, defineContentScript } from '#imports';
import '~/assets/tailwindcss.css';
import 'primeicons/primeicons.css';
import 'primevue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import App from './content/app.vue';
import { ConfirmationService, ToastService } from 'primevue';
import { runTaskMessageId, type runInfoFlowGet_task } from '@/services/InfoFlowGet/messageProtocol';
import { el } from 'date-fns/locale';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    // 监听来自后台脚本的消息
    console.log('[browser.runtime.id]', browser.runtime.id);
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // console.log('Content script 收到消息:', message);
      if (message.action === runTaskMessageId) {
        const task = message.data as runInfoFlowGet_task;
        console.log('[task]', task);
        execTask(task).then((res) => {
          // 向后台发送响应
          setTimeout(() => {
            sendResponse(res);
          }, 10_000);
        });
      }
      // 返回 true 表示会异步发送响应
      return true;
    });

    // createShadowRootUi 模式会导致无法正确的加载primevue组件的样式
    const ui = await createShadowRootUi(ctx, {
      name: 'infoflow-ui',
      // const ui = await createIntegratedUi(ctx, {
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
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
      },
      onRemove: (app) => {
        app?.unmount();
      },
    });
    ui.mount();
  },
});

async function execTask(task: runInfoFlowGet_task) {
  const hrefs = [...document
    .querySelectorAll('a')
    .values()
    .map((el) => el.href)];
  console.log('[hrefs]', hrefs);
  return hrefs;
}
