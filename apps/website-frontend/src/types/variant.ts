/**
 * 语义化变体类型 - 统一所有 UI 组件的 variant 命名
 * Toast、Badge、Tag、Message 等组件都应基于此类型扩展
 */
export type SemanticVariant = 'success' | 'error' | 'info' | 'warn' | 'warning' | 'danger';

/** 基础 UI 组件变体（Badge、Tag 等使用） */
export type UIVariant = Extract<SemanticVariant, 'success' | 'info' | 'warn' | 'danger'> | 'secondary' | 'contrast';

/** 消息组件变体（Message 使用） */
export type MessageVariant = Extract<SemanticVariant, 'success' | 'error' | 'info' | 'warn'>;
