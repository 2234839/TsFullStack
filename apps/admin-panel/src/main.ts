import { createApp } from 'vue';
import './style.css';
/** https://primevue.org/icons/ */
import 'primeicons/primeicons.css'
import App from './BaseLayout.vue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import { router } from './router';
import { ConfirmationService, ToastService } from 'primevue';

const app = createApp(App);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
});
app.use(ToastService);
app.use(ConfirmationService);
app.use(router);
app.mount('#app');
