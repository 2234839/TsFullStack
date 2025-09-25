// ABOUTME: 新的构建脚本，自动生成依赖和聚合导入导出

import { ModuleDiscoverer } from './src/discover';
import { PackageGenerator } from './src/package-generator';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface BuildOptions {
  watch?: boolean;
  exclude?: string[];
  outputDir?: string;
}

async function build(options: BuildOptions = {}) {
  console.log('🚀 开始构建模块自动加载系统...');

  // 创建发现器
  const discoverer = new ModuleDiscoverer(join(__dirname, '..'));

  // 发现模块
  console.log('🔍 正在发现模块...');
  const modules = await discoverer.discoverModules(options.exclude || []);

  console.log(`✅ 发现 ${modules.length} 个模块:`);
  modules.forEach(module => {
    console.log(`  - ${module.name} (v${module.packageJson.version})`);
    console.log(`    API: ${module.hasApi ? '✅' : '❌'}`);
    console.log(`    Frontend: ${module.hasFrontend ? '✅' : '❌'}`);
  });

  // 创建包生成器
  const packageGenerator = new PackageGenerator();

  // 生成 package.json 依赖
  console.log('\n📦 更新 package.json 依赖...');
  await packageGenerator.generatePackageWithDependencies(modules);

  // 生成聚合导入导出
  console.log('\n📝 生成聚合导入导出...');
  const { apiImports, frontendImports } = packageGenerator.generateModuleImports(modules);

  // 重新安装依赖
  console.log('\n📥 重新安装依赖...');
  try {
    execSync('pnpm install', {
      cwd: __dirname,
      stdio: 'inherit'
    });
    console.log('✅ 依赖安装完成');
  } catch (error) {
    console.error('❌ 依赖安装失败:', error);
    process.exit(1);
  }

  // 写入生成的文件
  const outputDir = options.outputDir || './src/generated';
  const fs = await import('node:fs');
  const { writeFileSync, mkdirSync, existsSync } = fs;

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // 写入 API 聚合文件
  writeFileSync(join(outputDir, 'api.ts'), apiImports);
  console.log('✅ 生成 API 聚合导入');

  // 写入 Frontend 聚合文件
  writeFileSync(join(outputDir, 'frontend.ts'), frontendImports);
  console.log('✅ 生成 Frontend 聚合导入');

  // 编译 TypeScript (可选)
  console.log('\n🔧 编译 TypeScript...');
  try {
    execSync('npx tsc --project tsconfig.json', {
      cwd: __dirname,
      stdio: 'inherit'
    });
    console.log('✅ TypeScript 编译完成');
  } catch (error) {
    console.warn('⚠️ TypeScript 编译警告，但构建继续');
  }

  console.log('\n🎉 构建完成！');
}

// 处理命令行参数
const args = process.argv.slice(2);
const options: BuildOptions = {};

if (args.includes('--watch')) {
  options.watch = true;
}

if (args.includes('--exclude')) {
  const excludeIndex = args.indexOf('--exclude');
  options.exclude = args[excludeIndex + 1]?.split(',') || [];
}

if (args.includes('--output')) {
  const outputIndex = args.indexOf('--output');
  options.outputDir = args[outputIndex + 1];
}

// 运行构建
build(options).catch(console.error);