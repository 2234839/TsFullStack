// Module discovery service implementation
import fg from 'fast-glob';
import fs from 'fs-extra';
import { join, dirname } from 'path';
import { ModuleInfo, ModuleDiscoveryOptions } from './types.js';

export class ModuleDiscovery {
  private options: Required<ModuleDiscoveryOptions>;

  constructor(options: ModuleDiscoveryOptions = {}) {
    this.options = {
      rootDir: options.rootDir || process.cwd(),
      modulesDir: options.modulesDir || 'modules',
      modulePattern: options.modulePattern || '*/package.json',
      outputDir: options.outputDir || 'packages/module-loader/generated',
      watch: options.watch || false,
      targetPackages: options.targetPackages || [
        'apps/backend/package.json',
        'apps/website-frontend/package.json'
      ]
    };
  }

  /** Discover all modules in the modules directory */
  async discoverModules(): Promise<ModuleInfo[]> {
    const modulesPath = join(this.options.rootDir, this.options.modulesDir);
    const pattern = join(modulesPath, this.options.modulePattern);
    
    try {
      const packageJsonFiles = fg.globSync(pattern, { absolute: true });
      const modules: ModuleInfo[] = [];

      for (const packageFile of packageJsonFiles) {
        const moduleDir = dirname(packageFile);
        const modulePath = join(this.options.modulesDir, moduleDir.split('/').pop()!);
        
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf-8'));
          
          // Check if module has backend/frontend files
          const hasBackend = fs.existsSync(join(moduleDir, 'backend'));
          const hasFrontend = fs.existsSync(join(moduleDir, 'frontend'));
          const hasVueComponents = fs.existsSync(join(moduleDir, 'frontend', 'vue.ts'));
          
          modules.push({
            name: packageJson.name,
            version: packageJson.version || '1.0.0',
            path: modulePath,
            packageJson,
            hasBackend,
            hasFrontend,
            hasVueComponents
          });
        } catch (error) {
          console.warn(`Failed to parse package.json for ${moduleDir}:`, error);
        }
      }

      return modules.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error discovering modules:', error);
      return [];
    }
  }

  /** Generate workspace dependencies for modules */
  generateWorkspaceDependencies(modules: ModuleInfo[]): Record<string, string> {
    const dependencies: Record<string, string> = {};
    
    for (const module of modules) {
      dependencies[module.name] = 'workspace:*';
    }
    
    return dependencies;
  }

  /** Get root directory */
  getRootDir(): string {
    return this.options.rootDir;
  }

  /** Get modules directory */
  getModulesDir(): string {
    return join(this.options.rootDir, this.options.modulesDir);
  }

  /** Get output directory */
  getOutputDir(): string {
    return join(this.options.rootDir, this.options.outputDir);
  }

  /** Get options */
  getOptions(): Required<ModuleDiscoveryOptions> {
    return this.options;
  }
}