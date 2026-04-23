import { t } from '@/i18n';

/**
 * 安全地从 unknown error 中提取错误消息
 * 统一替代分散在代码库中的 `error instanceof Error ? error.message : fallback` 模式
 */
export function getErrorMessage(error: unknown, fallback?: string): string {
  const defaultFallback = t('未知错误');
  return error instanceof Error ? error.message : String(error) || (fallback ?? defaultFallback);
}
