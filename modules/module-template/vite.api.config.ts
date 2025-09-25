import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  appType: 'custom',
  build: {
    outDir: 'dist/api',
    lib: {
      entry: resolve(__dirname, 'api/index.ts'),
      name: 'ModuleAPI',
      fileName: 'index',
      formats: ['cjs'],
    },
    sourcemap: true,
    target: 'node18',
  },
});
