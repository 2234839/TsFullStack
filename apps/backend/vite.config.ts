import { defineConfig } from "vite-plus";
import { execSync } from "child_process";

/** 构建 commit hash（构建时注入，用于线上版本追踪） */
const GIT_COMMIT = execSync("git rev-parse --short HEAD").toString().trim();
const BUILD_TIME = new Date().toISOString();

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
      entry: ["src/index.ts"],
      outDir: "dist",
      format: ["esm"],
      sourcemap: true,
      clean: true,
      define: {
        __GIT_COMMIT__: JSON.stringify(GIT_COMMIT),
        __BUILD_TIME__: JSON.stringify(BUILD_TIME),
      },
      deps: {
        alwaysBundle: ["@tsfullstack/note-calc-engine"],
        neverBundle: [
          "better-sqlite3",
          "bindings",
          "prebuild-install",
          "node-gyp",
          "node-gyp-build",
          "@prisma/adapter-better-sqlite3",
          "@prisma/client",
          "@prisma/debug",
          "@prisma/generator-helper",
          "@prisma/runtime",
          "@prisma/runtime-library",
          "@zenstackhq/runtime",
          "@zenstackhq/orm",
          "@zenstackhq/plugin-policy",
          "@zenstackhq/schema",
        ],
      },
    },
    {
      entry: ["src/lib/index.ts"],
      outDir: "dist-lib",
      dts: true,
      format: ["esm"],
      sourcemap: true,
      clean: true,
      deps: {
        neverBundle: [
          "@zenstackhq/orm",
          "@zenstackhq/plugin-policy",
          "@zenstackhq/runtime",
          "kysely",
          "better-sqlite3",
          "fastify",
          "superjson",
          "bcryptjs",
          "crypto-js",
          "uuid",
          "@fastify/cors",
          "@fastify/multipart",
          "@fastify/static",
        ],
      },
    },
  ],
});
