/**
 * 安全地从 unknown error 中提取错误消息
 * 统一替代分散在代码库中的 `error instanceof Error ? error.message : fallback` 模式
 */
export function getErrorMessage(error: unknown, fallback = '未知错误'): string {
  return error instanceof Error ? error.message : String(error) || fallback;
}
