#!/usr/bin/env node

// CLI interface for module loader
import { ModuleLoader } from './index.js';
import { Command } from 'commander';
import fs from 'fs-extra';
import { dirname, join } from 'path';

const program = new Command();

// 自动查找项目根目录
function findProjectRoot(startDir: string = process.cwd()): string {
  let currentDir = startDir;
  
  while (currentDir !== '/') {
    // 检查是否是项目根目录的标志
    const indicators = [
      'pnpm-workspace.yaml',
      'package.json',
      'apps',
      'packages',
      'modules'
    ];
    
    const hasIndicators = indicators.some(indicator => 
      fs.existsSync(join(currentDir, indicator))
    );
    
    // 必须同时有 pnpm-workspace.yaml 和 modules 目录才是真正的根目录
    const hasWorkspaceYaml = fs.existsSync(join(currentDir, 'pnpm-workspace.yaml'));
    const hasModulesDir = fs.existsSync(join(currentDir, 'modules'));
    
    if (hasIndicators && hasWorkspaceYaml && hasModulesDir) {
      return currentDir;
    }
    
    currentDir = dirname(currentDir);
  }
  
  // 如果没找到，返回当前目录
  return startDir;
}

program
  .name('tsfullstack-modules')
  .description('TsFullStack module auto-discovery and aggregation tool')
  .version('1.0.0');

program
  .command('run')
  .description('Run module discovery and aggregation')
  .option('-w, --watch', 'Watch for changes')
  .option('--root <dir>', 'Root directory', process.cwd())
  .option('--modules <dir>', 'Modules directory', 'modules')
  .option('--output <dir>', 'Output directory', 'packages/module-loader/generated')
  .action(async (options) => {
    try {
      // 如果没有指定根目录，自动查找项目根目录
      const rootDir = options.root === process.cwd() ? findProjectRoot() : options.root;
      const loader = new ModuleLoader({
        rootDir,
        modulesDir: options.modules,
        outputDir: options.output,
        watch: options.watch
      });

      if (options.watch) {
        await loader.watch();
      } else {
        await loader.run();
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List discovered modules')
  .option('--root <dir>', 'Root directory', process.cwd())
  .option('--modules <dir>', 'Modules directory', 'modules')
  .action(async (options) => {
    try {
      // 如果没有指定根目录，自动查找项目根目录
      const rootDir = options.root === process.cwd() ? findProjectRoot() : options.root;
      const loader = new ModuleLoader({
        rootDir,
        modulesDir: options.modules
      });

      const modules = await loader.getModules();
      
      console.log('Discovered modules:');
      modules.forEach(module => {
        console.log(`  - ${module.name} (${module.version})`);
        console.log(`    Path: ${module.path}`);
        console.log(`    Features: ${module.hasBackend ? 'backend' : ''}${module.hasFrontend ? ' frontend' : ''}${module.hasVueComponents ? ' vue' : ''}`);
        console.log();
      });
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('install')
  .description('Update dependencies and install packages')
  .option('--root <dir>', 'Root directory', process.cwd())
  .option('--modules <dir>', 'Modules directory', 'modules')
  .action(async (options) => {
    try {
      // 如果没有指定根目录，自动查找项目根目录
      const rootDir = options.root === process.cwd() ? findProjectRoot() : options.root;
      const loader = new ModuleLoader({
        rootDir,
        modulesDir: options.modules
      });

      const result = await loader.run();
      
      if (result.modules.length > 0) {
        console.log('Running pnpm install...');
        const { execSync } = await import('child_process');
        execSync('pnpm install', { 
          stdio: 'inherit',
          cwd: rootDir
        });
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program.parse();