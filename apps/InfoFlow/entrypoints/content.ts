import { browser, createApp, createShadowRootUi, defineContentScript } from '#imports';
import '~/assets/tailwindcss.css';
import 'primeicons/primeicons.css';
import 'primevue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import App from './content/app.vue';
import { ConfirmationService, ToastService } from 'primevue';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    // 监听来自后台脚本的消息
    console.log('[browser.runtime.id]', browser.runtime.id);
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Content script 收到消息:', message);
      if (message.action === 'helloFromBackground') {
        console.log('消息数据:', message.data);

        // 向后台发送响应
        sendResponse({
          success: true,
          reply: 'Content script 收到消息了!',
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
