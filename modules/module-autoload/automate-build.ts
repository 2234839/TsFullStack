#!/usr/bin/env node

// ABOUTME: 完全自动化的构建流程，包括依赖分析、增量编译、聚合生成和打包
// 生成时间: 2025-09-25T04:05:50.346Z

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ModuleInfo {
  name: string;
  path: string;
  hasBuildScript: boolean;
  buildOrder: number;
  dependencies: string[];
}

// 获取所有模块信息 - 高性能优化版本
function getAllModules(): ModuleInfo[] {
  const modules: ModuleInfo[] = [];

  // 使用批量文件系统操作，减少系统调用
  const scanDirs = [
    join(__dirname, '..'),          // modules 目录
    join(__dirname, '..', '..', 'packages') // packages 目录
  ];

  // 批量检查目录存在性
  const validDirs = scanDirs.filter(scanDir => {
    try {
      return existsSync(scanDir);
    } catch {
      return false;
    }
  });

  // 批量读取所有目录
  for (const scanDir of validDirs) {
    let dirs: string[];
    try {
      dirs = readdirSync(scanDir);
    } catch (error) {
      console.warn(`⚠️  无法读取目录 ${scanDir}: ${error.message}`);
      continue;
    }

    // 批量处理模块，减少重复的文件系统调用
    const candidateDirs = dirs.filter(dir => dir !== 'module-autoload');

    for (const dir of candidateDirs) {
      const modulePath = join(scanDir, dir);
      const packageJsonPath = join(modulePath, 'package.json');

      if (!existsSync(packageJsonPath)) continue;

      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

        // 获取模块依赖
        const dependencies = Object.keys(packageJson.dependencies || {})
          .filter(dep => dep.startsWith('@tsfullstack/') && dep !== '@tsfullstack/module-autoload');

        modules.push({
          name: dir,
          path: modulePath,
          hasBuildScript: !!(packageJson.scripts?.build || packageJson.scripts?.['build:lib']),
          buildOrder: 0,
          dependencies
        });
      } catch (error) {
        console.warn(`⚠️  无法读取模块 ${dir} 的 package.json: ${error.message}`);
      }
    }
  }

  return modules;
}

// 计算构建顺序（拓扑排序）
function calculateBuildOrder(modules: ModuleInfo[]): ModuleInfo[] {
  const moduleMap = new Map(modules.map(m => [m.name, m]));
  const visited = new Set<string>();
  const tempVisited = new Set<string>();
  const ordered: ModuleInfo[] = [];

  function visit(moduleName: string, depth = 0): void {
    if (tempVisited.has(moduleName)) {
      console.warn(`⚠️  检测到循环依赖: ${moduleName}`);
      return;
    }

    if (visited.has(moduleName)) {
      return;
    }

    tempVisited.add(moduleName);
    const module = moduleMap.get(moduleName);

    if (module) {
      // 先构建依赖
      for (const dep of module.dependencies) {
        const depName = dep.replace('@tsfullstack/', '');
        visit(depName, depth + 1);
      }

      module.buildOrder = depth;
      ordered.push(module);
    }

    tempVisited.delete(moduleName);
    visited.add(moduleName);
  }

  // 访问所有模块
  for (const module of modules) {
    if (!visited.has(module.name)) {
      visit(module.name);
    }
  }

  // 按构建顺序排序（依赖少的先构建）
  return ordered.sort((a, b) => a.buildOrder - b.buildOrder);
}

// 使用 turbo 增量构建 - 简化版本，让 Turbo 自动处理并发
function buildWithTurbo(modules: ModuleInfo[]): void {
  if (modules.length === 0) {
    console.log('📭 没有需要构建的模块');
    return;
  }

  console.log('🔨 使用 turbo 进行并行增量构建...');

  try {
    const rootDir = join(__dirname, '..', '..');

    // 简化：直接使用 Turbo，让它自动处理依赖关系和并发
    const moduleFilters = modules.map(m => `--filter=@tsfullstack/${m.name}`).join(' ');
    const turboCmd = `pnpm turbo build ${moduleFilters}`;

    console.log(`🚀 Turbo 自动并行构建模块: ${modules.map(m => m.name).join(', ')}`);
    console.log(`🔧 构建命令: ${turboCmd}`);

    execSync(turboCmd, {
      stdio: 'inherit',
      cwd: rootDir,
      timeout: 600000,
      maxBuffer: 1024 * 1024 * 20,
      env: { ...process.env, NODE_ENV: 'production' }
    });

    console.log('✅ Turbo 并行增量构建完成');
  } catch (error) {
    console.error('❌ Turbo 并行构建失败:', error.message);
    throw error;
  }
}



// 更新当前模块的依赖
function updateAutoloadDependencies(modules: ModuleInfo[]): void {
  console.log('🔄 更新 autoload 模块依赖...');

  const packageJsonPath = join(__dirname, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  // 更新 dependencies
  const dependencies = {};
  for (const module of modules) {
    const packageName = `@tsfullstack/${module.name}`;
    dependencies[packageName] = 'workspace:*';
  }

  // 保留非工作区依赖
  for (const [key, value] of Object.entries(packageJson.dependencies)) {
    if (!key.startsWith('@tsfullstack/') || key === '@tsfullstack/module-autoload') {
      dependencies[key] = value;
    }
  }

  packageJson.dependencies = dependencies;

  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  console.log('✅ 依赖配置更新完成（跳过安装，稍后统一处理）');
}

// 生成聚合代码
function generateAggregatedCode(): void {
  console.log('📝 生成聚合代码...');

  try {
    // 直接执行生成逻辑，避免重复的依赖安装
    execSync('tsx generate.ts --skip-deps', {
      stdio: 'inherit',
      cwd: __dirname,
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 10
    });
    console.log('✅ 聚合代码生成完成');
  } catch (error) {
    console.error('❌ 聚合代码生成失败:', error.message);
    throw error;
  }
}

// 构建 autoload 模块
function buildAutoload(): void {
  console.log('📦 构建 autoload 模块...');

  try {
    // 只执行构建，不重新生成聚合代码（因为前面已经生成过了）
    execSync('tsc --project tsconfig.build.json', {
      stdio: 'inherit',
      cwd: __dirname,
      timeout: 300000, // 5分钟超时
      maxBuffer: 1024 * 1024 * 10
    });
    console.log('✅ Autoload 模块构建完成');
  } catch (error) {
    console.error('❌ Autoload 模块构建失败:', error.message);
    throw error;
  }
}

// 统一依赖安装函数 - 高性能优化版本
function installDependencies(): void {
  console.log('📥 智能依赖安装...');

  try {
    const rootDir = join(__dirname, '..', '..');
    const lockfilePath = join(rootDir, 'pnpm-lock.yaml');

    // 检查是否真的需要安装依赖
    if (existsSync(lockfilePath)) {
      console.log('📋 检测到 lockfile，使用智能增量安装...');

      // 使用更高效的 pnpm 参数
      const installCmd = process.env.CI
        ? 'pnpm install --frozen-lockfile=true --silent'
        : 'pnpm install --frozen-lockfile=false --prefer-offline --reporter=silent';

      execSync(installCmd, {
        stdio: 'inherit',
        cwd: rootDir,
        timeout: 300000,
        maxBuffer: 1024 * 1024 * 10,
        env: {
          ...process.env,
          PNPM_CACHE_FOLDER: join(rootDir, '.pnpm-cache'),
          NODE_ENV: 'production'
        }
      });
    } else {
      console.log('📋 未检测到 lockfile，执行优化安装...');

      execSync('pnpm install --frozen-lockfile=false --prefer-offline', {
        stdio: 'inherit',
        cwd: rootDir,
        timeout: 600000, // 增加超时时间
        maxBuffer: 1024 * 1024 * 20, // 增加 buffer
        env: {
          ...process.env,
          PNPM_CACHE_FOLDER: join(rootDir, '.pnpm-cache'),
          NODE_ENV: 'production'
        }
      });
    }

    console.log('✅ 依赖安装完成');
  } catch (error) {
    console.error('❌ 依赖安装失败:', error.message);

    // 回退到保守的安装方式
    console.log('🔄 回退到保守安装方式...');
    try {
      const rootDir = join(__dirname, '..', '..');
      execSync('pnpm install', {
        stdio: 'inherit',
        cwd: rootDir,
        timeout: 900000,
        maxBuffer: 1024 * 1024 * 30
      });
    } catch (fallbackError) {
      console.error('❌ 保守安装也失败:', fallbackError.message);
      throw fallbackError;
    }
  }
}

// 主函数
async function main() {
  console.log('🚀 启动完全自动化构建流程...\n');

  try {
    // 1. 获取所有模块信息
    console.log('📋 分析模块依赖关系...');
    const allModules = getAllModules();
    console.log(`🔍 发现 ${allModules.length} 个模块`);

    if (allModules.length === 0) {
      console.log('📭 没有发现其他模块，跳过依赖构建');
      // 仍然需要安装依赖、生成聚合代码和构建 autoload
      installDependencies();
      generateAggregatedCode();
      buildAutoload();
    } else {
      // 2. 计算构建顺序
      console.log('📊 计算构建顺序...');
      const orderedModules = calculateBuildOrder(allModules);
      console.log(`📈 构建顺序: ${orderedModules.map(m => m.name).join(' -> ')}\n`);

      // 3. 过滤需要构建的模块
      const buildableModules = orderedModules.filter(m => m.hasBuildScript);
      console.log(`🔨 ${buildableModules.length} 个模块需要构建\n`);

      // 4. 构建依赖模块
      if (buildableModules.length > 0) {
        buildWithTurbo(buildableModules);
      }

      // 5. 更新 autoload 依赖
      updateAutoloadDependencies(orderedModules);

      // 6. 统一安装所有依赖
      installDependencies();

      // 7. 生成聚合代码（跳过重复的依赖安装）
      generateAggregatedCode();

      // 8. 构建 autoload 模块
      buildAutoload();
    }

    console.log('\n🎉 完全自动化构建流程完成！');
    console.log('📦 输出文件: dist/');
    console.log('📋 可通过以下方式引用:');
    console.log('   - 主入口: import { api, components } from "@tsfullstack/module-autoload"');
    console.log('   - API 专用: import { api } from "@tsfullstack/module-autoload/api"');
    console.log('   - 前端专用: import { components } from "@tsfullstack/module-autoload/frontend"');

  } catch (error) {
    console.error('\n❌ 自动化构建流程失败:', error.message);
    process.exit(1);
  }
}

main();