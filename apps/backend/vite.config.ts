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
      // 冷启动优化：纯 JS 依赖全部内联进单文件，只保留原生模块类依赖
      // （better-sqlite3 的 .node binding、bindings/node-gyp-build 的运行时原生解析无法内联）
      deps: {
        // '*' 匹配常规 npm 依赖全量内联（vp pack 的 alwaysBundle 走 picomatch 匹配器，
        // 布尔 true 在 1.4.0 会崩）；workspace 包与 peer 依赖语义独立，需显式列出才内联
        alwaysBundle: [
          '*',
          '@tsfullstack/note-calc-engine',
          '@zenstackhq/orm',
          '@zenstackhq/plugin-policy',
          '@zenstackhq/plugin-soft-delete',
          '@zenstackhq/runtime',
          '@fastify/cors',
          '@fastify/multipart',
          '@fastify/static',
        ],
        neverBundle: ['better-sqlite3', 'bindings', 'prebuild-install', 'node-gyp', 'node-gyp-build'],
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
