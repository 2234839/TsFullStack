import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  appType: 'custom',
  build: {
    outDir: 'dist/api',
    lib: {
      entry: resolve(__dirname, 'api/index.ts'),
      fileName: 'api',
      formats: ['es'],
    },
    sourcemap: true,
    target: 'node18',
    rollupOptions: {
      external: ['node:fs/promises'],
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  plugins: [
    dts({
      tsconfigPath: './tsconfig.api.json',
      outDir: 'dist/api/types',
      copyDtsFiles: true,
      rollupTypes: false,
    })
  ]
});
