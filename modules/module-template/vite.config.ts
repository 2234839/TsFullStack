import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'frontend'),
      '@api': resolve(__dirname, 'api')
    }
  },
  build: {
    outDir: 'dist/frontend',
    sourcemap: true
  }
})