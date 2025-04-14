import { createApp } from 'vue';
import './style.css';
import App from './BaseLayout.vue';

import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import { router } from './router';
import { ToastService } from 'primevue';

const app = createApp(App);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
});
app.use(ToastService);
app.use(router);
app.mount('#app');
