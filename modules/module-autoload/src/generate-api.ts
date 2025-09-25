// ABOUTME: 生成 API 端的聚合导入导出代码

import { join } from 'node:path';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { ModuleInfo } from './types';

export class ApiGenerator {
  private outputDir: string;

  constructor(outputDir = './dist') {
    this.outputDir = outputDir;
  }

  generate(modules: ModuleInfo[]): void {
    const apiModules = modules.filter(m => m.hasApi);

    if (apiModules.length === 0) {
      console.log('No API modules found to generate');
      return;
    }

    // 生成聚合导入文件
    this.generateAggregateImports(apiModules);

    // 生成类型定义文件
    this.generateTypeDefinitions(apiModules);

    // 生成独立的模块导出文件
    this.generateIndividualExports(apiModules);
  }

  private generateAggregateImports(modules: ModuleInfo[]): void {
    const imports: string[] = [];
    const exports: string[] = [];
    const typeImports: string[] = [];
    const typeExports: string[] = [];

    modules.forEach(module => {
      const moduleName = module.name.replace('module-', '');

      // 生成导入语句 - 使用 workspace 路径
      imports.push(`import * as ${moduleName} from '@tsfullstack/${module.name}';`);
      typeImports.push(`import type * as ${moduleName}Types from '@tsfullstack/${module.name}';`);

      // 生成导出语句
      exports.push(`export { ${moduleName} };`);
      typeExports.push(`export type * as ${moduleName}Types from '@tsfullstack/${module.name}';`);
    });

    const content = `
// ABOUTME: 自动生成的 API 聚合导入导出文件
// 生成时间: ${new Date().toISOString()}
// 包含模块: ${modules.map(m => m.name).join(', ')}

${imports.join('\n')}
${typeImports.join('\n')}

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
`;

    const outputPath = join(this.outputDir, 'api.ts');
    this.ensureDir(this.outputDir);
    writeFileSync(outputPath, content.trim());
    console.log(`Generated API aggregate imports: ${outputPath}`);
  }

  private generateTypeDefinitions(modules: ModuleInfo[]): void {
    const types: string[] = [];

    modules.forEach(module => {
      const moduleName = module.name.replace('module-', '');
      types.push(`// ${module.name} API 类型定义`);
      types.push(`export type ${moduleName}Api = typeof import('@tsfullstack/${module.name}/api');`);
    });

    const content = `
// ABOUTME: 自动生成的 API 类型定义
// 生成时间: ${new Date().toISOString()}

${types.join('\n\n')}

// 所有模块 API 的联合类型
export type AllModuleApis = {
${modules.map(m => `  ${m.name.replace('module-', '')}: ${m.name.replace('module-', '')}Api`).join(',\n')}
};
`;

    const outputPath = join(this.outputDir, 'api-types.ts');
    this.ensureDir(this.outputDir);
    writeFileSync(outputPath, content.trim());
    console.log(`Generated API type definitions: ${outputPath}`);
  }

  private generateIndividualExports(modules: ModuleInfo[]): void {
    modules.forEach(module => {
      const moduleName = module.name.replace('module-', '');
      const content = `
// ABOUTME: ${module.name} API 的独立导出文件
// 版本: ${module.packageJson.version}

export * from '@tsfullstack/${module.name}/api';
export type * from '@tsfullstack/${module.name}/api';
`;

      const outputPath = join(this.outputDir, `api-${moduleName}.ts`);
      this.ensureDir(this.outputDir);
      writeFileSync(outputPath, content.trim());
    });
  }

  private ensureDir(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}