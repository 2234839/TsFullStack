import { defineConfig } from 'tsup';

export default defineConfig({
  // 入口文件，根据你的项目结构调整
  entry: ['src/index.ts'],
  // 输出目录
  outDir: 'dist',
  // 生成类型声明文件
  dts: false,
  // 打包格式
  format: 'esm',
  // 代码分割
  splitting: false,
  minify: true,
  // 生成 sourcemap
  sourcemap: true,
  // 清除输出目录
  clean: true,
  // 忽略 watch 的文件,减少文件描述符使用
  ignoreWatch: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist-lib/**',
    '**/dist/**',
    '**/.zenstack/**',
    '**/coverage/**',
    '**/.vscode/**',
    '**/.idea/**',
    '**/*.log',
    '**/.env*',
    '**/config.example.json',
    '**/config.json',
    '**/*.db',
    '**/*.db-*',
    '**/*.md',
    '**/CLAUDE.md',
  ],
  // 开发模式下排除所有npm包依赖
  // external: [/node_modules/],
  noExternal: [],
});
