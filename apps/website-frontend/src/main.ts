import '@/style.css';
import { createApp } from 'vue';
/** https://primevue.org/icons/ */
import App from '@/BaseLayout.vue';
import { i18n, initI18n } from '@/i18n';
import { router } from '@/router';
import { theme_darkModeClass } from '@/storage';
import { Noir } from '@/theme';
import 'primeicons/primeicons.css';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';
import PrimeVue from 'primevue/config';
import Tooltip from 'primevue/tooltip';

const app = createApp(App);
// @ts-expect-error
app.directive('tooltip', Tooltip);

app.use(i18n);
initI18n();

app.use(PrimeVue, {
  theme: {
    preset: Noir,
    options: {
      darkModeSelector: `.${theme_darkModeClass}`,
    },
  },
});
// @ts-expect-error
app.use(ToastService);
// @ts-expect-error
app.use(ConfirmationService);
app.use(router);

app.mount('#app');
