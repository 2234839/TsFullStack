/**
 * ZenStack 增强的 Prisma 客户端错误处理工具
 *
 * 参考: https://zenstack.dev/docs/reference/error-handling
 */

import { extractErrorMessage } from './error';

/**
 * ZenStack 权限错误的拒绝原因
 */
type ZenStackRejectReason =
  | 'ACCESS_POLICY_VIOLATION' /** 访问策略违规 */
  | 'RESULT_NOT_READABLE' /** 结果不可读 */
  | 'DATA_VALIDATION_VIOLATION'; /** 数据验证错误 */

/**
 * ZenStack P2004 错误的元数据
 */
interface ZenStackErrorMeta {
  reason: ZenStackRejectReason;
  zodErrors?: unknown;
}

/** 检查值是否为非 null 对象（类型守卫） */
function isObject(error: unknown): error is Record<string, unknown> {
  return typeof error === 'object' && error !== null && !Array.isArray(error);
}

/** 检查错误是否为 ZenStack P2004 错误对象 */
function isP2004Error(error: Record<string, unknown>): boolean {
  return error.code === 'P2004' && isObject(error.meta);
}

/** 从错误对象中安全提取 ZenStack 元数据 */
function extractZenStackMeta(error: Record<string, unknown>): ZenStackErrorMeta | null {
  const meta = error.meta;
  if (!isObject(meta)) return null;
  /** Prisma meta → ZenStackErrorMeta: 运行时结构已知兼容，编译期无法从 Record<string,unknown> 推导 */
  return meta as unknown as ZenStackErrorMeta;
}

/**
 * 检查错误是否为 ZenStack 权限策略错误 (P2004)
 */
export function isZenStackPermissionError(error: unknown): boolean {
  if (!isObject(error) || !isP2004Error(error)) return false;
  const meta = extractZenStackMeta(error);
  return meta?.reason === 'ACCESS_POLICY_VIOLATION';
}

/**
 * 检查错误是否为 ZenStack 数据验证错误 (P2004)
 */
export function isZenStackValidationError(error: unknown): boolean {
  if (!isObject(error) || !isP2004Error(error)) return false;
  const meta = extractZenStackMeta(error);
  return meta?.reason === 'DATA_VALIDATION_VIOLATION';
}

/**
 * 获取 ZenStack 错误的详细信息
 */
function getZenStackErrorDetails(error: unknown): {
  isPermissionError: boolean;
  isValidationError: boolean;
  isNotReadableError: boolean;
  reason?: ZenStackRejectReason;
  zodErrors?: unknown;
} {
  if (!isObject(error) || error.code !== 'P2004' || !isObject(error.meta)) {
    return {
      isPermissionError: false,
      isValidationError: false,
      isNotReadableError: false,
    };
  }

  const meta = extractZenStackMeta(error);
  if (!meta) {
    return { isPermissionError: false, isValidationError: false, isNotReadableError: false };
  }
  const { reason, zodErrors } = meta;

  return {
    isPermissionError: reason === 'ACCESS_POLICY_VIOLATION',
    isValidationError: reason === 'DATA_VALIDATION_VIOLATION',
    isNotReadableError: reason === 'RESULT_NOT_READABLE',
    reason,
    zodErrors,
  };
}

/**
 * 检查错误是否为 Prisma "记录不存在" 错误 (P2025)
 */
export function isRecordNotFoundError(error: unknown): boolean {
  return isObject(error) && error.code === 'P2025';
}

/**
 * 创建一个用于日志的详细错误信息
 */
export function createDetailedErrorMessage(error: unknown, context: string): string {
  const details = getZenStackErrorDetails(error);

  if (details.reason) {
    return `[${context}] ZenStack 错误 - ${details.reason}`;
  }

  if (isRecordNotFoundError(error)) {
    return `[${context}] 记录不存在 (P2025)`;
  }

  const errorMessage = extractErrorMessage(error);
  return `[${context}] ${errorMessage}`;
}
