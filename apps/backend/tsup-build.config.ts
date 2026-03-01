import { defineConfig } from 'tsup';

export default defineConfig({
  // 入口文件，根据你的项目结构调整
  entry: ['src/index.ts'],
  // 输出目录
  outDir: 'dist',
  // 生成类型声明文件
  dts: false,
  // 打包格式 - 使用 ESM 避免 ESM/CJS 兼容性问题
  format: 'esm',
  // 代码分割
  splitting: false,
  minify: false,
  // 不要使用 shims，在 ESM 中不需要
  shims: false,
  // 生成 sourcemap
  sourcemap: true,
  // 清除输出目录
  clean: true,
  // 忽略 watch 的文件
  ignoreWatch: ['**/node_modules/**', '**/.git/**'],
  // 不打包依赖，让 Node.js 在运行时加载（解决 ESM/CJS 兼容性问题）
  // tsup 默认会排除 dependencies 和 peerDependencies
  // 只需要明确排除 native 模块即可
  external: [
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
    '@zenstackhq/schema',
  ],
});
