import '@/style.css';
import { createApp } from 'vue';
/** https://primevue.org/icons/ */
import App from '@/BaseLayout.vue';
import { i18n, initI18n } from '@/i18n';
import { router } from '@/router';
import { theme_darkModeClass, theme, theme_randomMode } from '@/storage';
import { Noir } from '@/theme';
import 'primeicons/primeicons.css';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';
import PrimeVue from 'primevue/config';

/** 开发环境下初始化随机主题 */
if (import.meta.env.DEV && theme_randomMode.value) {
  theme.value = Math.random() > 0.5 ? 'dark' : 'light';
}

const app = createApp(App);

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
app.use(ToastService);
app.use(ConfirmationService);
app.use(router);

app.mount('#app');
