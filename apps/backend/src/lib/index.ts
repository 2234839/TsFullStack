/**
 * Frontend-safe types and utilities from the backend
 * WARNING: This file should only contain what frontend actually needs
 */

// ZenStack v3 生成的完整模型类型（仅在必要时使用）
// 这些类型非常复杂，会导致 TypeScript 编译内存溢出

export type { OauthProvider, StorageType, FileStatusEnum, LogLevel, TokenType, TaskType, TaskStatus, AiModelType } from '../../.zenstack/models';

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
export { MsgError } from '../util/error';
export type { MsgErrorOpValues } from '../util/error';

// ZenStack v3 基础参数类型（用于 AutoTable CRUD 接口）
// 注意：这些类型非常复杂，前端应该通过 API 方法签名推断，而不是直接导入
export type * from '@zenstackhq/orm';

export type { DeepAsyncEffect } from '../rpc/index';

// 模型元数据 - 用于 AutoTable 等组件
export { ModelMeta } from '../db/model-meta';
export type { ModelMeta as ModelMetaType } from '../db/model-meta';

// 枚举值导出 - 前端兼容
import {
  OauthProvider,
  StorageType,
  FileStatusEnum,
  LogLevel,
  TokenType,
  TaskType,
  TaskStatus,
  AiModelType,
} from '../../.zenstack/models';

export const $Enums = {
  OauthProvider,
  StorageType,
  FileStatusEnum,
  LogLevel,
  TokenType,
  TaskType,
  TaskStatus,
  AiModelType,
} as const;

/** 代币系统相关的类型标签和选项配置 */
export const TokenOptions = {
  /** 代币类型标签映射 */
  TokenTypeLabels: {
    MONTHLY: '月度代币',
    YEARLY: '年度代币',
    PERMANENT: '永久代币',
  } as const,

  /** 代币类型选项（用于 Select 组件） */
  TokenTypeOptions: [
    { value: 'MONTHLY', label: '月度代币' },
    { value: 'YEARLY', label: '年度代币' },
    { value: 'PERMANENT', label: '永久代币' },
  ],

  /** 任务类型标签映射 */
  TaskTypeLabels: {
    AI_IMAGE_GENERATION: 'AI 图片生成',
    AI_TEXT_GENERATION: 'AI 文本生成',
    AI_TRANSLATION: 'AI 翻译',
    AI_VIDEO_GENERATION: 'AI 视频生成',
    CUSTOM: '自定义任务',
  } as const,

  /** 任务类型选项（用于专用代币选择） */
  TaskTypeOptions: [
    { value: 'AI_IMAGE_GENERATION', label: 'AI 图片生成' },
    { value: 'AI_TEXT_GENERATION', label: 'AI 文本生成' },
    { value: 'AI_TRANSLATION', label: 'AI 翻译' },
    { value: 'AI_VIDEO_GENERATION', label: 'AI 视频生成' },
  ],

  /** 任务状态标签映射 */
  TaskStatusLabels: {
    PENDING: '等待处理',
    PROCESSING: '处理中',
    COMPLETED: '已完成',
    FAILED: '失败',
    CANCELLED: '已取消',
  } as const,
} as const;

// NOTE: Backend service classes are NOT exported to frontend:
// - DbService, AuthContext, AIProxyService
// - AppConfigService, AIConfigContext
// These are backend-only implementations
