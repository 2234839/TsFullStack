import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  sourcemap: true,
  clean: true,
  deps: {
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
      '@zenstackhq/schema',
    ],
  },
});
