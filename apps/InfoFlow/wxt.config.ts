import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  // 修改了这里记得去浏览器重载扩展
  manifest: {
    permissions: ['storage'],
  },
});
