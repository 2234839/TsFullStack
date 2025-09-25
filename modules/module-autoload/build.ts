// ABOUTME: 构建脚本，执行模块发现和代码生成

import { ModuleDiscoverer } from './src/discover';
import { ApiGenerator } from './src/generate-api';
import { FrontendGenerator } from './src/generate-frontend';
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

  // 生成 API 聚合
  console.log('\n📦 生成 API 聚合...');
  const apiGenerator = new ApiGenerator(options.outputDir || './dist');
  apiGenerator.generate(modules);

  // 生成 Frontend 聚合
  console.log('\n🎨 生成 Frontend 聚合...');
  const frontendGenerator = new FrontendGenerator(options.outputDir || './dist');
  frontendGenerator.generate(modules);

  // 编译 TypeScript
  console.log('\n🔧 编译 TypeScript...');
  try {
    execSync('npx tsc --project tsconfig.json', {
      cwd: __dirname,
      stdio: 'inherit'
    });
    console.log('✅ TypeScript 编译完成');
  } catch (error) {
    console.error('❌ TypeScript 编译失败:', error);
    process.exit(1);
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