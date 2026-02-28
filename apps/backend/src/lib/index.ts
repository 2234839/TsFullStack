/**
 * Frontend-safe types and utilities from the backend
 * WARNING: This file should only contain what frontend actually needs
 */

// ZenStack v3 生成的完整模型类型（仅在必要时使用）
// 这些类型非常复杂，会导致 TypeScript 编译内存溢出

export type { OauthProvider, StorageType, FileStatusEnum, LogLevel } from '../../.zenstack/models';

// ZenStack schema 类型定义 - 用于前端类型推断
export { schema } from '../../.zenstack/schema';
export type { SchemaDef } from '@zenstackhq/schema';
export type { FieldDef, ModelDef, RelationInfo } from '@zenstackhq/schema';

// RPC utilities - core functionality for frontend-backend communication
export { createRPC, proxyCall } from '../rpc';

// API interface types - required for type-safe RPC calls
export type { API } from '../api';
export type { AppAPI } from '../api/appApi';

// Session authentication - required for API calls
export * as SessionAuthSign from './SessionAuthSign';

// Error handling types - required for API error handling
export type { MsgErrorOpValues } from '../util/error';

// ZenStack v3 基础参数类型（用于 AutoTable CRUD 接口）
// 注意：这些类型非常复杂，前端应该通过 API 方法签名推断，而不是直接导入
export type * from '@zenstackhq/orm';

export type { DeepAsyncEffect } from '../rpc/index';

// 模型元数据 - 用于 AutoTable 等组件
export { ModelMeta } from '../db/model-meta';
export type { ModelMeta as ModelMetaType } from '../db/model-meta';

// 枚举值导出 - 前端兼容
import { OauthProvider, StorageType, FileStatusEnum, LogLevel } from '../../.zenstack/models';
export const $Enums = {
  OauthProvider,
  StorageType,
  FileStatusEnum,
  LogLevel,
} as const;

// NOTE: Backend service classes are NOT exported to frontend:
// - PrismaService, AuthContext, AIProxyService
// - AppConfigService, AIConfigContext
// These are backend-only implementations
