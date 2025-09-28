import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

import { PrimeVueResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'

export default defineConfig({
  plugins: [
    Components({ resolvers: [PrimeVueResolver()], dts: true }),
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
      entry: {
        frontend: resolve(__dirname, 'frontend/index.ts'),
        routeMap: resolve(__dirname, 'frontend/src/routeMap.ts')
      },
      fileName: (format, entryName) => `${entryName}.js`,
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