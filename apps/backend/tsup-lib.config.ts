import { defineConfig } from 'tsup';

export default defineConfig({
  // 入口文件，根据你的项目结构调整
  entry: ['src/lib/index.ts'],
  // 输出目录
  outDir: 'dist-lib',
  // 生成类型声明文件,对于 prisma 的复杂类型会报错
  // dts: true,
  // 改成使用 tsc 生成类型声明文件，因为可以输出 .d.ts.map 文件,这样就可以直接从前端跳转到后端代码
  experimentalDts: false,
  // 打包格式
  format: ['esm'],
  // 代码分割
  splitting: false,
  // 生成 sourcemap
  sourcemap: true,
  // 清除输出目录
  clean: true,
  // 忽略 watch 的文件
  ignoreWatch: ['**/node_modules/**', '**/.git/**'],
  // 适用于 Prisma 的特殊配置
  esbuildOptions: (options) => {
    // 如果你的项目使用 Prisma，需要添加以下配置
    options.platform = 'node';
    options.target = 'node16';
  },
  // 开发模式下排除所有npm包依赖
  external: [/node_modules/],
});
