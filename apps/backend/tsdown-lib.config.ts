import { defineConfig } from 'tsdown';

export default defineConfig({
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
      'effect',
      'fastify',
      'superjson',
      'bcryptjs',
      'crypto-js',
      'uuid',
      '@fastify/cors',
      '@fastify/multipart',
      '@fastify/static',
    ],
  },
});
