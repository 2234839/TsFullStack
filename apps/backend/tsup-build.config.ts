import { defineConfig } from 'tsup';

export default defineConfig({
  // 入口文件，根据你的项目结构调整
  entry: ['src/index.ts'],
  // 输出目录
  outDir: 'dist',
  // 生成类型声明文件
  dts: false,
  // 打包格式
  format: 'cjs',
  // 代码分割
  splitting: false,
  // minify: true,
  minify: false,
  shims:true,
  // 生成 sourcemap
  sourcemap: true,
  // 清除输出目录
  clean: false,
  // 忽略 watch 的文件
  ignoreWatch: ['**/node_modules/**', '**/.git/**'],
  // 打包全部依赖
  noExternal: [/.*/],
});
