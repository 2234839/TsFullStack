import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import '~/src/styles/app.css';
import 'primeicons/primeicons.css';
import { ConfirmationService, ToastService, Tooltip } from 'primevue';

export function setupApp(App: any) {
  const app = createApp(App);
  app.use(PrimeVue, {
    theme: {
      preset: Aura,
    },
  });
  app.use(ToastService);
  app.use(ConfirmationService);
  app.directive('tooltip', Tooltip);

  app.mount('#app');
}
