import '@/style.css';
import { createApp } from 'vue';
/** https://primevue.org/icons/ */
import App from '@/BaseLayout.vue';
import { i18n, initI18n } from '@/i18n';
import { router } from '@/router';
import { theme, theme_randomMode } from '@/storage';
import 'primeicons/primeicons.css';

/** 开发环境下初始化随机主题 */
if (import.meta.env.DEV && theme_randomMode.value) {
  theme.value = Math.random() > 0.5 ? 'dark' : 'light';
}

const app = createApp(App);

app.use(i18n);
initI18n();
app.use(router);

app.mount('#app');
