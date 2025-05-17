import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import vueDevTools from 'vite-plugin-vue-devtools';
import vueJsx from '@vitejs/plugin-vue-jsx';
// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx(), tailwindcss(), vueDevTools()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['aframe'],
  },
  build: {
    sourcemap: true,
  },
});
