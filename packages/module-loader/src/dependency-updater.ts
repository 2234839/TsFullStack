// Package.json dependency updater implementation
import fs from 'fs-extra';
import { join } from 'path';
import { execSync } from 'child_process';
import { ModuleInfo } from './types.js';
import { ModuleDiscovery } from './discovery.js';

export class DependencyUpdater {
  private discovery: ModuleDiscovery;

  constructor(discovery: ModuleDiscovery) {
    this.discovery = discovery;
  }

  /** Update dependencies in a package.json file */
  async updatePackageDependencies(packagePath: string, modules: ModuleInfo[]): Promise<boolean> {
    try {
      const fullPath = join(this.discovery.getRootDir(), packagePath);
      
      if (!fs.existsSync(fullPath)) {
        console.warn(`Package file not found: ${fullPath}`);
        return false;
      }

      const packageJson = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const workspaceDependencies = this.discovery.generateWorkspaceDependencies(modules);
      
      // Merge with existing dependencies
      const existingDependencies = packageJson.dependencies || {};
      const updatedDependencies = {
        ...existingDependencies,
        ...workspaceDependencies
      };

      // Remove dependencies for modules that no longer exist, but only manage @tsfullstack/module- prefixed packages
      const moduleNames = new Set(modules.map(m => m.name));
      const removedDeps: string[] = [];
      for (const depName of Object.keys(updatedDependencies)) {
        if (depName.startsWith('@tsfullstack/module-') && !moduleNames.has(depName) && depName !== '@tsfullstack/module-loader') {
          delete updatedDependencies[depName];
          removedDeps.push(depName);
        }
      }
      
      
      // Ensure @tsfullstack/module-loader is always present
      updatedDependencies['@tsfullstack/module-loader'] = 'workspace:*';

      // Check if dependencies actually changed
      const dependenciesChanged = JSON.stringify(existingDependencies) !== JSON.stringify(updatedDependencies);

      if (dependenciesChanged) {
        packageJson.dependencies = updatedDependencies;
        fs.writeFileSync(fullPath, JSON.stringify(packageJson, null, 2) + '\n');
        console.log(`Updated dependencies in: ${packagePath}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error updating dependencies in ${packagePath}:`, error);
      return false;
    }
  }

  /** Update all target package files */
  async updateAllDependencies(modules: ModuleInfo[]): Promise<void> {
    console.log('Updating package dependencies...');

    const targetPackages = this.discovery.getOptions().targetPackages;
    let updatedCount = 0;

    // Update target packages (backend and frontend)
    for (const packagePath of targetPackages) {
      const updated = await this.updatePackageDependencies(packagePath, modules);
      if (updated) updatedCount++;
    }

    // Also update module-loader package dependencies for aggregated file imports
    const moduleLoaderPackagePath = 'packages/module-loader/package.json';
    const moduleLoaderUpdated = await this.updatePackageDependencies(moduleLoaderPackagePath, modules);
    if (moduleLoaderUpdated) updatedCount++;

    if (updatedCount > 0) {
      console.log(`Updated dependencies in ${updatedCount} package files`);
      console.log('Installing dependencies...');

      try {
        const rootDir = this.discovery.getRootDir();
        const moduleLoaderDir = join(rootDir, 'packages/module-loader');

        // Change to module-loader directory and run pnpm install
        process.chdir(moduleLoaderDir);
        execSync('pnpm install', {
          stdio: 'inherit',
          cwd: moduleLoaderDir
        });

        console.log('Dependencies installed successfully');
      } catch (error) {
        console.error('Failed to install dependencies:', error);
        throw error;
      }
    } else {
      console.log('No dependency updates needed');
    }
  }
}