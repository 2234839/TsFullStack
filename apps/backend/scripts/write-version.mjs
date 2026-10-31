#!/usr/bin/env node
/**
 * 构建前生成 src/generated/version.ts（git commit + 构建时间）。
 *
 * 为什么不用 vite define 注入：define 常量会被 vite-plus 构建缓存折叠缓存住，
 * git HEAD 变化不会使缓存失效，导致线上 /version 显示旧 commit（2026-10-31 部署事故）。
 * 写入源码文件后，文件内容变化天然使增量缓存失效。
 *
 * 内容有变化才重写，避免 mtime 无谓变动。
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 允许失败（如浅克隆/无 git 环境），回退 unknown */
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
  } catch {
    return 'unknown';
  }
})();
const buildTime = new Date().toISOString();

const target = resolve(root, 'src/generated/version.ts');
const content = `/* eslint-disable */
// 由 scripts/write-version.mjs 构建前生成，勿手改
/** 构建时的 git commit（短 hash） */
export const GIT_COMMIT = '${commit}';
/** 构建时间（ISO 字符串） */
export const BUILD_TIME = '${buildTime}';
`;

mkdirSync(dirname(target), { recursive: true });
let existing = null;
try {
  existing = readFileSync(target, 'utf8');
} catch {}
if (existing !== content) {
  writeFileSync(target, content);
  console.log(`[write-version] ${commit} @ ${buildTime}`);
} else {
  console.log(`[write-version] 已是最新 ${commit}，跳过重写`);
}
