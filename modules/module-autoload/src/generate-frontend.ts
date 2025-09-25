// ABOUTME: 生成前端的聚合导入导出代码

import { join } from 'node:path';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { ModuleInfo } from './types';

export class FrontendGenerator {
  private outputDir: string;

  constructor(outputDir = './dist') {
    this.outputDir = outputDir;
  }

  generate(modules: ModuleInfo[]): void {
    const frontendModules = modules.filter(m => m.hasFrontend);

    if (frontendModules.length === 0) {
      console.log('No frontend modules found to generate');
      return;
    }

    // 生成聚合导入文件
    this.generateAggregateImports(frontendModules);

    // 生成 Vue 插件文件
    this.generateVuePlugin(frontendModules);

    // 生成类型定义文件
    this.generateTypeDefinitions(frontendModules);

    // 生成独立的模块导出文件
    this.generateIndividualExports(frontendModules);
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
// ABOUTME: 自动生成的前端聚合导入导出文件
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

// 导出所有模块的前端组件
export const components = {
${modules.map(m => `  ${m.name.replace('module-', '')}`).join(',\n  ')}
};
`;

    const outputPath = join(this.outputDir, 'frontend.ts');
    this.ensureDir(this.outputDir);
    writeFileSync(outputPath, content.trim());
    console.log(`Generated frontend aggregate imports: ${outputPath}`);
  }

  private generateVuePlugin(modules: ModuleInfo[]): void {
    const pluginImports: string[] = [];
    const pluginInstalls: string[] = [];

    modules.forEach(module => {
      const moduleName = module.name.replace('module-', '');

      pluginImports.push(`import ${moduleName} from '@tsfullstack/${module.name}';`);
      pluginInstalls.push(`  ${moduleName}.install?.(app);`);
    });

    const content = `
// ABOUTME: 自动生成的 Vue 插件
// 生成时间: ${new Date().toISOString()}
// 包含模块: ${modules.map(m => m.name).join(', ')}

import type { App } from 'vue';

${pluginImports.join('\n')}

export interface ModuleAutoloadOptions {
  // 插件配置选项
}

export default {
  install(app: App, options?: ModuleAutoloadOptions) {
    // 安装所有模块
${pluginInstalls.join('\n')}

    // 注册全局属性
    app.config.globalProperties.$modules = {
${modules.map(m => `      ${m.name.replace('module-', '')}`).join(',\n      ')}
    };

    console.log('[ModuleAutoload] 已加载 ${modules.length} 个模块');
  }
};

// 版本信息
export const version = '0.1.0';
`;

    const outputPath = join(this.outputDir, 'vue-plugin.ts');
    this.ensureDir(this.outputDir);
    writeFileSync(outputPath, content.trim());
    console.log(`Generated Vue plugin: ${outputPath}`);
  }

  private generateTypeDefinitions(modules: ModuleInfo[]): void {
    const types: string[] = [];

    modules.forEach(module => {
      const moduleName = module.name.replace('module-', '');
      types.push(`// ${module.name} 前端类型定义`);
      types.push(`export type ${moduleName}Frontend = typeof import('@tsfullstack/${module.name}/frontend');`);
    });

    const content = `
// ABOUTME: 自动生成的前端类型定义
// 生成时间: ${new Date().toISOString()}

${types.join('\n\n')}

// 所有模块前端的联合类型
export type AllModuleFrontends = {
${modules.map(m => `  ${m.name.replace('module-', '')}: ${m.name.replace('module-', '')}Frontend`).join(',\n')}
};

// Vue 插件类型
import type { App } from 'vue';

export interface ModuleAutoloadOptions {
  // 插件配置选项
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $modules: {
${modules.map(m => `      ${m.name.replace('module-', '')}: typeof import('@tsfullstack/${m.name}/frontend')`).join(',\n      ')}
    };
  }
}
`;

    const outputPath = join(this.outputDir, 'frontend-types.ts');
    this.ensureDir(this.outputDir);
    writeFileSync(outputPath, content.trim());
    console.log(`Generated frontend type definitions: ${outputPath}`);
  }

  private generateIndividualExports(modules: ModuleInfo[]): void {
    modules.forEach(module => {
      const moduleName = module.name.replace('module-', '');
      const content = `
// ABOUTME: ${module.name} 前端的独立导出文件
// 版本: ${module.packageJson.version}

export * from '@tsfullstack/${module.name}/frontend';
export type * from '@tsfullstack/${module.name}/frontend';
`;

      const outputPath = join(this.outputDir, `frontend-${moduleName}.ts`);
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