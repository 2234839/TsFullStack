import { defineConfig } from 'tsup';

export default defineConfig({
  // 入口文件，根据你的项目结构调整
  entry: ['src/lib/index.ts'],
  // 输出目录
  outDir: 'dist-lib',
  // 不使用 tsup 生成类型声明文件，完全使用 tsc
  dts: true,
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
    // options.platform = 'node';
    // options.target = 'node16';
  },
  // 排除所有外部依赖
  external: [
    '@zenstackhq/orm',
    '@zenstackhq/plugin-policy',
    // '@zenstackhq/schema', // 不能external，生成的文件需要引用它
    '@zenstackhq/runtime',
    'kysely',
    'better-sqlite3',
    'effect',
    'fastify',
    'superjson',
    'bcryptjs',
    'crypto-js',
    'uuid',
    '@fastify/cors',
    '@fastify/multipart',
    '@fastify/static'
  ],
  // 防止将生成的类型文件打包进来
  banner: ({ format }) => {
    if (format === 'esm') {
      return {
        js: '// ZenStack generated types are consumed from runtime',
      };
    }
  },
  });
