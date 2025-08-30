import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import VueDevTools from 'vite-plugin-vue-devtools';
// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  // @ts-ignore
  vite: () => ({
    plugins: [
      tailwindcss(),
      VueDevTools({
        // https://devtools.vuejs.org/help/faq#how-to-work-with-wxt
        // 对于 options 页面无效 https://github.com/vuejs/devtools/issues/727
        // appendTo: '/entrypoints/options/main.ts',
        // appendTo: '/entrypoints/popup/main.ts',
      }),
    ],
  }),
  manifest: {
    permissions: ['storage', 'tabs', 'notifications', 'activeTab', 'debugger'],
    action: {
      default_popup: undefined, // 禁用popup，点击直接打开options
    },
  },
  /** 禁止自动 import，更清晰的依赖流 */
  imports: false,
});
