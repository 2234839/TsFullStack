// Types for module discovery and aggregation
export interface ModuleDiscoveryOptions {
  /** Root directory of the project */
  rootDir?: string;
  /** Modules directory name */
  modulesDir?: string;
  /** Pattern to match module package.json files */
  modulePattern?: string;
  /** Output directory for aggregated files */
  outputDir?: string;
  /** Whether to watch for changes */
  watch?: boolean;
  /** Package files to update */
  targetPackages?: string[];
}

export interface ModuleInfo {
  name: string;
  version: string;
  path: string;
  packageJson: any;
  hasBackend: boolean;
  hasFrontend: boolean;
  hasVueComponents: boolean;
}

export interface AggregatedOutput {
  modules: ModuleInfo[];
  backendExports: string[];
  frontendExports: string[];
  vueExports: string[];
}