// ABOUTME: 模块自动发现功能，扫描 modules 目录下的所有模块

import fg from 'fast-glob';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ModuleInfo, PackageJson } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ModuleDiscoverer {
  private basePath: string;

  constructor(basePath = join(__dirname, '../../')) {
    this.basePath = basePath;
  }

  async discoverModules(exclude: string[] = []): Promise<ModuleInfo[]> {
    const modulePattern = join(this.basePath, '*/package.json');
    const packageFiles = await fg.glob(modulePattern, {
      ignore: exclude.map(pattern =>
        join(this.basePath, pattern, 'package.json')
      )
    });

    return packageFiles
      .map(packageFile => this.parseModule(packageFile))
      .filter((module): module is ModuleInfo => module !== null);
  }

  private parseModule(packageFile: string): ModuleInfo | null {
    try {
      const moduleDir = dirname(packageFile);
      const moduleName = basename(moduleDir);

      const packageContent = readFileSync(packageFile, 'utf-8');
      const packageJson: PackageJson = JSON.parse(packageContent);

      // 检查是否有 API 目录
      const apiPath = join(moduleDir, 'api');
      const hasApi = existsSync(apiPath) && existsSync(join(apiPath, 'index.ts'));

      // 检查是否有 frontend 目录
      const frontendPath = join(moduleDir, 'frontend');
      const hasFrontend = existsSync(frontendPath) && existsSync(join(frontendPath, 'index.ts'));

      return {
        name: moduleName,
        path: moduleDir,
        packageJson,
        hasApi,
        hasFrontend,
        apiPath: hasApi ? apiPath : undefined,
        frontendPath: hasFrontend ? frontendPath : undefined
      };
    } catch (error) {
      console.error(`Failed to parse module from ${packageFile}:`, error);
      return null;
    }
  }

  getModuleDependencies(modules: ModuleInfo[]): Set<string> {
    const dependencies = new Set<string>();

    modules.forEach(module => {
      Object.keys(module.packageJson.dependencies || {}).forEach(dep => {
        if (dep.startsWith('@tsfullstack/')) {
          dependencies.add(dep);
        }
      });
    });

    return dependencies;
  }
}