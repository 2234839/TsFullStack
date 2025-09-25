// ABOUTME: 自动生成 package.json 依赖和聚合导入导出

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ModuleInfo } from './types';

export class PackageGenerator {
  private packageJsonPath: string;

  constructor(baseDir = './') {
    this.packageJsonPath = join(baseDir, 'package.json');
  }

  async generatePackageWithDependencies(modules: ModuleInfo[]): Promise<void> {
    // 读取现有的 package.json
    const packageJson = this.readPackageJson();

    // 生成依赖项
    const dependencies = this.generateDependencies(modules);

    // 更新 package.json
    packageJson.dependencies = {
      ...packageJson.dependencies,
      ...dependencies
    };

    // 写入更新后的 package.json
    writeFileSync(this.packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`✅ 更新 package.json 依赖: ${Object.keys(dependencies).join(', ')}`);
  }

  private readPackageJson(): any {
    if (!existsSync(this.packageJsonPath)) {
      throw new Error(`package.json not found at ${this.packageJsonPath}`);
    }

    const content = readFileSync(this.packageJsonPath, 'utf-8');
    return JSON.parse(content);
  }

  private generateDependencies(modules: ModuleInfo[]): Record<string, string> {
    const dependencies: Record<string, string> = {};

    modules.forEach(module => {
      // 跳过 autoload 模块本身
      if (module.name === 'module-autoload') {
        return;
      }

      // 为每个模块添加 workspace 依赖
      dependencies[`@tsfullstack/${module.name}`] = 'workspace:*';
    });

    return dependencies;
  }

  generateModuleImports(modules: ModuleInfo[]): {
    apiImports: string;
    frontendImports: string;
    packageJson: any;
  } {
    const apiModules = modules.filter(m => m.hasApi && m.name !== 'module-autoload');
    const frontendModules = modules.filter(m => m.hasFrontend && m.name !== 'module-autoload');

    const apiImports = this.generateApiImports(apiModules);
    const frontendImports = this.generateFrontendImports(frontendModules);
    const packageJson = this.generateCompletePackageJson(modules);

    return {
      apiImports,
      frontendImports,
      packageJson
    };
  }

  private generateApiImports(modules: ModuleInfo[]): string {
    if (modules.length === 0) {
      return '// 没有找到 API 模块\nexport const api = {};';
    }

    const imports: string[] = [];
    const exports: string[] = [];
    const typeExports: string[] = [];

    modules.forEach(module => {
      const moduleName = module.name.replace('module-', '');

      imports.push(`import * as ${moduleName} from '@tsfullstack/${module.name}/api';`);
      // typeImports.push(`import type * as ${moduleName}Types from '@tsfullstack/${module.name}/api';`);

      exports.push(`export { ${moduleName} };`);
      typeExports.push(`export type * as ${moduleName}Types from '@tsfullstack/${module.name}/api';`);
    });

    return `
// ABOUTME: 自动生成的 API 聚合导入导出文件
// 生成时间: ${new Date().toISOString()}
// 包含模块: ${modules.map(m => m.name).join(', ')}

${imports.join('\n')}

${exports.join('\n')}
${typeExports.join('\n')}

// 版本信息
export const modules = {
${modules.map(m => `  '${m.name.replace('module-', '')}': '${m.packageJson.version}'`).join(',\n')}
};

// 导出所有模块的 API
export const api = {
${modules.map(m => `  ${m.name.replace('module-', '')}`).join(',\n  ')}
};

// 确保导出不被 tree-shaking 移除
if (process.env.NODE_ENV === 'development') {
  console.log('API modules:', Object.keys(modules));
  console.log('API exports:', Object.keys(api));
}
`.trim();
  }

  private generateFrontendImports(modules: ModuleInfo[]): string {
    if (modules.length === 0) {
      return '// 没有找到前端模块\nexport const components = {};';
    }

    const imports: string[] = [];
    const exports: string[] = [];
    const typeExports: string[] = [];

    modules.forEach(module => {
      const moduleName = module.name.replace('module-', '');

      imports.push(`import * as ${moduleName} from '@tsfullstack/${module.name}/frontend';`);
      // typeImports.push(`import type * as ${moduleName}Types from '@tsfullstack/${module.name}/frontend';`);

      exports.push(`export { ${moduleName} };`);
      typeExports.push(`export type * as ${moduleName}Types from '@tsfullstack/${module.name}/frontend';`);
    });

    return `
// ABOUTME: 自动生成的前端聚合导入导出文件
// 生成时间: ${new Date().toISOString()}
// 包含模块: ${modules.map(m => m.name).join(', ')}

${imports.join('\n')}

${exports.join('\n')}
${typeExports.join('\n')}

// 版本信息
export const modules = {
${modules.map(m => `  '${m.name.replace('module-', '')}': '${m.packageJson.version}'`).join(',\n')}
};

// 导出所有模块的前端组件
export const components = {
${modules.map(m => `  ${m.name.replace('module-', '')}`).join(',\n  ')}
};

// 确保导出不被 tree-shaking 移除
if (process.env.NODE_ENV === 'development') {
  console.log('Frontend modules:', Object.keys(modules));
  console.log('Frontend exports:', Object.keys(components));
}
`.trim();
  }

  private generateCompletePackageJson(modules: ModuleInfo[]): any {
    const basePackage = this.readPackageJson();

    // 生成依赖
    const dependencies: Record<string, string> = {};

    modules.forEach(module => {
      if (module.name !== 'module-autoload') {
        dependencies[`@tsfullstack/${module.name}`] = 'workspace:*';
      }
    });

    return {
      ...basePackage,
      dependencies: {
        ...basePackage.dependencies,
        ...dependencies
      }
    };
  }
}