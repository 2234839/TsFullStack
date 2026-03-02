/**
 * ZenStack 增强的 Prisma 客户端错误处理工具
 *
 * 参考: https://zenstack.dev/docs/reference/error-handling
 */

/**
 * ZenStack 权限错误的拒绝原因
 */
export type ZenStackRejectReason =
  | 'ACCESS_POLICY_VIOLATION' /** 访问策略违规 */
  | 'RESULT_NOT_READABLE' /** 结果不可读 */
  | 'DATA_VALIDATION_VIOLATION'; /** 数据验证错误 */

/**
 * ZenStack P2004 错误的元数据
 */
export interface ZenStackErrorMeta {
  reason: ZenStackRejectReason;
  zodErrors?: unknown;
}

/**
 * 检查错误是否为 ZenStack 权限策略错误 (P2004)
 */
export function isZenStackPermissionError(error: unknown): boolean {
  const prismaError = error as {
    code?: string;
    meta?: ZenStackErrorMeta;
  };

  return prismaError.code === 'P2004' && prismaError.meta?.reason === 'ACCESS_POLICY_VIOLATION';
}

/**
 * 检查错误是否为 ZenStack 数据验证错误 (P2004)
 */
export function isZenStackValidationError(error: unknown): boolean {
  const prismaError = error as {
    code?: string;
    meta?: ZenStackErrorMeta;
  };

  return prismaError.code === 'P2004' && prismaError.meta?.reason === 'DATA_VALIDATION_VIOLATION';
}

/**
 * 检查错误是否为 ZenStack 结果不可读错误 (P2004)
 */
export function isZenStackNotReadableError(error: unknown): boolean {
  const prismaError = error as {
    code?: string;
    meta?: ZenStackErrorMeta;
  };

  return prismaError.code === 'P2004' && prismaError.meta?.reason === 'RESULT_NOT_READABLE';
}

/**
 * 获取 ZenStack 错误的详细信息
 */
export function getZenStackErrorDetails(error: unknown): {
  isPermissionError: boolean;
  isValidationError: boolean;
  isNotReadableError: boolean;
  reason?: ZenStackRejectReason;
  zodErrors?: unknown;
} {
  const prismaError = error as {
    code?: string;
    meta?: ZenStackErrorMeta;
  };

  if (prismaError.code !== 'P2004' || !prismaError.meta) {
    return {
      isPermissionError: false,
      isValidationError: false,
      isNotReadableError: false,
    };
  }

  const { reason, zodErrors } = prismaError.meta;

  return {
    isPermissionError: reason === 'ACCESS_POLICY_VIOLATION',
    isValidationError: reason === 'DATA_VALIDATION_VIOLATION',
    isNotReadableError: reason === 'RESULT_NOT_READABLE',
    reason,
    zodErrors,
  };
}

/**
 * 格式化 ZenStack 错误为可读消息
 */
export function formatZenStackError(error: unknown): string {
  const details = getZenStackErrorDetails(error);

  if (details.isPermissionError) {
    return '操作被拒绝：权限不足';
  }

  if (details.isValidationError) {
    return '操作被拒绝：数据验证失败';
  }

  if (details.isNotReadableError) {
    return '操作被拒绝：无法读取结果';
  }

  // 如果不是 ZenStack 错误，返回默认消息
  return (error as Error)?.message || '未知错误';
}

/**
 * 检查错误是否为 Prisma "记录不存在" 错误 (P2025)
 */
export function isRecordNotFoundError(error: unknown): boolean {
  const prismaError = error as { code?: string };
  return prismaError.code === 'P2025';
}

/**
 * 创建一个用于日志的详细错误信息
 */
export function createDetailedErrorMessage(error: unknown, context: string): string {
  const details = getZenStackErrorDetails(error);

  if (details.reason) {
    // ZenStack 相关错误
    return `[${context}] ZenStack 错误 - ${details.reason}`;
  }

  if (isRecordNotFoundError(error)) {
    return `[${context}] 记录不存在 (P2025)`;
  }

  // 其他错误
  const errorMessage = (error as Error)?.message || '未知错误';
  return `[${context}] ${errorMessage}`;
}
