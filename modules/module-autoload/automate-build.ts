#!/usr/bin/env node

// ABOUTME: 完全自动化的构建流程，包括依赖分析、增量编译、聚合生成和打包
// 生成时间: 2025-09-25T04:05:50.346Z

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, relative } from 'path';
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

// 获取所有模块信息
function getAllModules(): ModuleInfo[] {
  const modulesDir = join(__dirname, '..');
  const modules: ModuleInfo[] = [];

  // 扫描模块目录
  const moduleDirs = existsSync(modulesDir) ?
    readdirSync(modulesDir).filter(dir =>
      dir !== 'module-autoload' &&
      existsSync(join(modulesDir, dir, 'package.json'))
    ) : [];

  for (const moduleDir of moduleDirs) {
    const modulePath = join(modulesDir, moduleDir);
    const packageJsonPath = join(modulePath, 'package.json');

    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      // 获取模块依赖
      const dependencies = Object.keys(packageJson.dependencies || {})
        .filter(dep => dep.startsWith('@tsfullstack/') && dep !== '@tsfullstack/module-autoload');

      modules.push({
        name: moduleDir,
        path: modulePath,
        hasBuildScript: !!(packageJson.scripts?.build || packageJson.scripts?.['build:lib']),
        buildOrder: 0, // 将在后续计算
        dependencies
      });
    } catch (error) {
      console.warn(`⚠️  无法读取模块 ${moduleDir} 的 package.json: ${error.message}`);
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

// 使用 turbo 增量构建
function buildWithTurbo(modules: ModuleInfo[]): void {
  if (modules.length === 0) {
    console.log('📭 没有需要构建的模块');
    return;
  }

  console.log('🔨 使用 turbo 进行增量构建...');

  // 优化：使用正确的 workspace 名称格式
  const moduleNames = modules.map(m => m.name);
  const filterPattern = moduleNames.map(name => `@tsfullstack/${name}`).join(',');

  try {
    const rootDir = join(__dirname, '..', '..');
    const turboCmd = `pnpm turbo build --filter="${filterPattern}"`;

    console.log(`🚀 执行命令: ${turboCmd}`);
    execSync(turboCmd, {
      stdio: 'inherit',
      cwd: rootDir,
      timeout: 300000, // 5分钟超时
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });

    console.log('✅ Turbo 增量构建完成');
  } catch (error) {
    console.error('❌ Turbo 构建失败:', error.message);

    // 回退到单独构建
    console.log('🔄 回退到单独构建模式...');
    buildModulesIndividually(modules);
  }
}

// 单独构建模块（fallback）
function buildModulesIndividually(modules: ModuleInfo[]): void {
  for (const module of modules) {
    if (!module.hasBuildScript) {
      console.log(`⏭️  跳过模块 ${module.name}（无构建脚本）`);
      continue;
    }

    try {
      console.log(`🔨 构建模块: ${module.name}`);
      execSync('pnpm build', {
        stdio: 'inherit',
        cwd: module.path,
        timeout: 180000, // 3分钟超时
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      console.log(`✅ 模块 ${module.name} 构建完成`);
    } catch (error) {
      console.error(`❌ 模块 ${module.name} 构建失败:`, error.message);
      throw error;
    }
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

  // 优化：只在必要时安装依赖
  try {
    console.log('📥 安装/更新依赖...');
    execSync('pnpm install --frozen-lockfile=false', {
      stdio: 'inherit',
      cwd: __dirname,
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 10
    });
    console.log('✅ 依赖更新完成');
  } catch (error) {
    console.error('❌ 依赖更新失败:', error.message);
    throw error;
  }
}

// 生成聚合代码
function generateAggregatedCode(): void {
  console.log('📝 生成聚合代码...');

  try {
    execSync('tsx generate.ts', {
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

    }

    // 5. 生成聚合代码（内部会处理依赖更新）
    generateAggregatedCode();

    // 6. 构建 autoload 模块
    buildAutoload();

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