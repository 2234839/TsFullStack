// ABOUTME: 模块自动发现和聚合导出的主入口文件

export { ModuleDiscoverer } from './discover';
export { ApiGenerator } from './generate-api';
export { FrontendGenerator } from './generate-frontend';
export { PackageGenerator } from './package-generator';
export type { ModuleInfo, PackageJson, GenerationOptions } from './types';

// 默认导出自动发现器
export { ModuleDiscoverer as default } from './discover';

// 便捷的前端聚合导出（包含路由聚合）
export * from './generated/frontend';