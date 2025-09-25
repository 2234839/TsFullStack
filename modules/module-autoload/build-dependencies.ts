#!/usr/bin/env node

// ABOUTME: 自动构建依赖模块，确保在生成聚合代码前所有依赖模块都已构建
// 生成时间: 2025-09-25T04:05:50.345Z

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 获取所有依赖模块
function getDependentModules() {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, 'package.json'), 'utf-8')
  );

  const modules = [];
  for (const [name, version] of Object.entries(packageJson.dependencies)) {
    if (typeof version === 'string' && version.startsWith('workspace:') && name.startsWith('@tsfullstack/')) {
      const moduleName = name.replace('@tsfullstack/', '');
      modules.push(moduleName);
    }
  }

  return modules;
}

// 构建依赖模块
function buildDependentModules(modules) {
  console.log('🔨 开始构建依赖模块...');

  for (const module of modules) {
    try {
      console.log(`📦 构建模块: ${module}`);
      const modulePath = join(__dirname, '..', module);

      // 使用 turbo 进行增量构建
      execSync(`cd ${modulePath} && pnpm build`, {
        stdio: 'inherit',
        cwd: modulePath
      });

      console.log(`✅ 模块 ${module} 构建完成`);
    } catch (error) {
      console.error(`❌ 模块 ${module} 构建失败:`, error.message);
      process.exit(1);
    }
  }
}

// 更新当前模块的依赖
function updateDependencies(modules) {
  console.log('🔄 更新模块依赖...');

  const packageJsonPath = join(__dirname, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  // 确保 devDependencies 包含必要的依赖
  const devDeps = packageJson.devDependencies || {};

  // 添加 turbo 依赖（如果还没有）
  if (!devDeps.turbo) {
    devDeps.turbo = '^1.12.3';
  }

  packageJson.devDependencies = devDeps;

  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  // 执行 pnpm install 确保依赖是最新的
  try {
    console.log('📥 安装/更新依赖...');
    execSync('pnpm install', {
      stdio: 'inherit',
      cwd: __dirname
    });
    console.log('✅ 依赖更新完成');
  } catch (error) {
    console.error('❌ 依赖更新失败:', error.message);
    process.exit(1);
  }
}

// 主函数
function main() {
  console.log('🚀 开始自动化依赖构建流程...\n');

  try {
    // 1. 获取依赖模块
    const modules = getDependentModules();
    console.log(`📋 发现 ${modules.length} 个依赖模块: ${modules.join(', ')}\n`);

    // 2. 构建依赖模块
    if (modules.length > 0) {
      buildDependentModules(modules);
    } else {
      console.log('📭 没有发现需要构建的依赖模块\n');
    }

    // 3. 更新当前模块依赖
    updateDependencies(modules);

    console.log('\n🎉 自动化依赖构建流程完成！');
  } catch (error) {
    console.error('❌ 自动化构建失败:', error.message);
    process.exit(1);
  }
}

main();