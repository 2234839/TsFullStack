// Main module loader coordinator
import { ModuleDiscovery } from './discovery.js';
import { DependencyUpdater } from './dependency-updater.js';
import { FrontendAggregator } from './frontend-aggregator.js';
import { BackendAggregator } from './backend-aggregator.js';
import { ModuleInfo, AggregatedOutput } from './types.js';
import * as fs from 'fs-extra';
import { join } from 'path';

export class ModuleLoader {
  private discovery: ModuleDiscovery;
  private dependencyUpdater: DependencyUpdater;
  private frontendAggregator: FrontendAggregator;
  private backendAggregator: BackendAggregator;

  constructor(options = {}) {
    this.discovery = new ModuleDiscovery(options);
    this.dependencyUpdater = new DependencyUpdater(this.discovery);
    this.frontendAggregator = new FrontendAggregator(this.discovery);
    this.backendAggregator = new BackendAggregator(this.discovery);
  }

  /** Run the complete module loading process */
  async run(): Promise<AggregatedOutput> {
    console.log('🔍 Discovering modules...');
    const modules = await this.discovery.discoverModules();
    
    console.log(`📦 Found ${modules.length} modules:`);
    modules.forEach(module => {
      console.log(`  - ${module.name} (${module.version}) [${module.hasBackend ? 'backend' : ''}${module.hasFrontend ? ' frontend' : ''}${module.hasVueComponents ? ' vue' : ''}]`);
    });

    if (modules.length === 0) {
      console.log('⚠️  No modules found');
      return {
        modules: [],
        backendExports: [],
        frontendExports: [],
        vueExports: []
      };
    }

    // Update dependencies
    console.log('🔄 Updating dependencies...');
    await this.dependencyUpdater.updateAllDependencies(modules);

    // Generate aggregated files
    console.log('📄 Generating aggregated files...');
    await this.frontendAggregator.generateFrontendAggregation(modules);
    await this.backendAggregator.generateBackendAggregation(modules);

    // Generate summary
    const output: AggregatedOutput = {
      modules,
      backendExports: modules.filter(m => m.hasBackend).map(m => m.name),
      frontendExports: modules.filter(m => m.hasFrontend).map(m => m.name),
      vueExports: modules.filter(m => m.hasVueComponents).map(m => m.name)
    };

    console.log('✅ Module loading complete!');
    return output;
  }

  /** Get discovered modules */
  async getModules(): Promise<ModuleInfo[]> {
    return await this.discovery.discoverModules();
  }

  /** Watch for module changes */
  async watch(): Promise<void> {
    const chokidar = await import('chokidar');
    const modulesDir = this.discovery.getModulesDir();
    
    console.log(`👀 Watching for changes in ${modulesDir}...`);
    
    const watcher = chokidar.watch(modulesDir, {
      ignored: /node_modules/,
      persistent: true
    });

    watcher.on('change', async () => {
      console.log('🔄 Module changes detected, reloading...');
      await this.run();
    });

    watcher.on('add', async () => {
      console.log('🆕 New module detected, reloading...');
      await this.run();
    });

    watcher.on('unlink', async () => {
      console.log('❌ Module removed, reloading...');
      await this.run();
    });
  }

  /** Get output directory */
  getOutputDir(): string {
    return this.discovery.getOutputDir();
  }
}