import { defineConfig } from 'vite-plus';

/**
 * backend 构建配置（vp pack 读取）
 *
 * 使用数组形式一次构建两个产物：
 * 1. dist/      —— 服务器运行入口（src/index.ts）
 * 2. dist-lib/  —— 供前端导入的 SDK 库（src/lib/index.ts，含类型声明）
 */
export default defineConfig({
  pack: [
    {
      /** dbWorker 与主入口同目录输出（dist/index.mjs 与 dist/workerEntry.mjs），运行时用 import.meta.url 相对定位 */
      entry: ['src/index.ts', 'src/Context/dbWorker/workerEntry.ts'],
      outDir: 'dist',
      format: ['esm'],
      sourcemap: true,
      clean: true,
      deps: {
        alwaysBundle: ['@tsfullstack/note-calc-engine'],
        neverBundle: [
          'better-sqlite3',
          'bindings',
          'prebuild-install',
          'node-gyp',
          'node-gyp-build',
          '@prisma/adapter-better-sqlite3',
          '@prisma/client',
          '@prisma/debug',
          '@prisma/generator-helper',
          '@prisma/runtime',
          '@prisma/runtime-library',
          '@zenstackhq/runtime',
          '@zenstackhq/orm',
          '@zenstackhq/plugin-policy',
          '@zenstackhq/plugin-soft-delete',
          '@zenstackhq/schema',
        ],
      },
    },
    {
      entry: ['src/lib/index.ts'],
      outDir: 'dist-lib',
      dts: true,
      format: ['esm'],
      sourcemap: true,
      clean: true,
      deps: {
        neverBundle: [
          '@zenstackhq/orm',
          '@zenstackhq/plugin-policy',
          '@zenstackhq/runtime',
          'kysely',
          'better-sqlite3',
          'fastify',
          'superjson',
          'bcryptjs',
          'uuid',
          '@fastify/cors',
          '@fastify/multipart',
          '@fastify/static',
        ],
      },
    },
  ],
});
