import fs from 'node:fs';
import { defineConfig, lazyPlugins } from 'vite-plus';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';

/**
 * TS7（tsgo）删除了 ts.sys，@vue/compiler-sfc 解析 defineProps<导入类型> 的
 * fs 回退链（options.fs → ts.sys）全部落空，必须显式提供。
 * 形状对齐 compiler-sfc resolveFS 的包装约定（.vue.ts 改写规则）。
 */
const sfcFs = {
  fileExists(file: string) {
    if (file.endsWith('.vue.ts') && !file.endsWith('.d.vue.ts')) file = file.replace(/\.ts$/, '');
    return fs.existsSync(file);
  },
  readFile(file: string) {
    if (file.endsWith('.vue.ts') && !file.endsWith('.d.vue.ts')) file = file.replace(/\.ts$/, '');
    return fs.readFileSync(file, 'utf-8');
  },
  realpath(file: string) {
    return fs.realpathSync.native(file);
  },
};

export default defineConfig({
  plugins: lazyPlugins(() => [vue({ script: { fs: sfcFs } })]),
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SharedFrontend',
      fileName: (format) => `shared-frontend.${format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['vue', 'vue-router', 'reka-ui'],
      output: {
        globals: {
          vue: 'Vue',
          'vue-router': 'VueRouter',
          'reka-ui': 'RekaUI',
        },
      },
    },
    sourcemap: true,
  },
});
