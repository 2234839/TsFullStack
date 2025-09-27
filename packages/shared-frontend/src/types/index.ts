// ABOUTME: 共享类型定义
export interface BaseModuleConfig {
  name: string;
  version: string;
  enabled: boolean;
}

export interface ModuleFrontendConfig extends BaseModuleConfig {
  routes?: import('../utils/routeUtil').RouteTree;
  components?: Record<string, unknown>;
}

export interface ModuleApiConfig extends BaseModuleConfig {
  endpoints?: Record<string, unknown>;
  services?: Record<string, unknown>;
}

// 重新导出路由相关类型
export type { RouteNode, RouteTree, RouteNodeMeta } from '../utils/routeUtil';