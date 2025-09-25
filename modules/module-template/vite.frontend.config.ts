import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: './tsconfig.app.json',
      outDir: 'dist/frontend/types',
      copyDtsFiles: true,
      rollupTypes: false,
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'frontend'),
      '@api': resolve(__dirname, 'api')
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'frontend/index.ts'),
      fileName: 'frontend',
      formats: ['es']
    },
    outDir: 'dist/frontend',
    sourcemap: true,
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    }
  }
})