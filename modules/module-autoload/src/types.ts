// ABOUTME: 模块自动发现和聚合导出的类型定义

export interface ModuleInfo {
  name: string;
  path: string;
  packageJson: PackageJson;
  hasApi: boolean;
  hasFrontend: boolean;
  apiPath?: string;
  frontendPath?: string;
}

export interface PackageJson {
  name: string;
  version: string;
  main?: string;
  module?: string;
  types?: string;
  exports?: Record<string, any>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface GenerationOptions {
  basePath?: string;
  exclude?: string[];
  outputDir?: string;
  format?: 'esm' | 'cjs' | 'both';
}