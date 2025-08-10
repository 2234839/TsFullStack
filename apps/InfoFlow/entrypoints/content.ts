import { createApp, createShadowRootUi, defineContentScript } from '#imports';
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
