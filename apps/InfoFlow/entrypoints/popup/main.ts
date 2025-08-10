import { createApp } from 'vue';
import App from './App.vue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import '~/assets/tailwindcss.css';
import 'primeicons/primeicons.css'
import { ConfirmationService, ToastService } from 'primevue';

const app = createApp(App);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
});
app.use(ToastService);
app.use(ConfirmationService);

app.mount('#app');