import { defineConfig } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SharedFrontend',
      fileName: (format) => `shared-frontend.${format}.js`,
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: ['vue', 'vue-router', 'reka-ui'],
      output: {
        globals: {
          vue: 'Vue',
          'vue-router': 'VueRouter',
          'reka-ui': 'RekaUI'
        }
      }
    },
    sourcemap: true
  }
});