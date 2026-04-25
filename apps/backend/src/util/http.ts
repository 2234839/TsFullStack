import { GITHUB_FETCH_TIMEOUT_MS, IMAGE_DOWNLOAD_TIMEOUT_MS, AI_IMAGE_API_TIMEOUT_MS, OPENAI_PROXY_TIMEOUT_MS, OLLAMA_API_TIMEOUT_MS, PAYMENT_API_TIMEOUT_MS } from './constants';

/** 各场景超时映射（与 constants.ts 同步） */
export const FETCH_TIMEOUTS = {
  github: GITHUB_FETCH_TIMEOUT_MS,
  imageDownload: IMAGE_DOWNLOAD_TIMEOUT_MS,
  aiImage: AI_IMAGE_API_TIMEOUT_MS,
  openaiProxy: OPENAI_PROXY_TIMEOUT_MS,
  ollama: OLLAMA_API_TIMEOUT_MS,
  payment: PAYMENT_API_TIMEOUT_MS,
} as const;

/**
 * 为 fetch 请求注入 AbortSignal.timeout 超时控制
 *
 * @param init - 原始 RequestInit
 * @param timeoutMs - 超时毫秒数，0 或 undefined 不注入
 * @returns 合并了超时 signal 的新 RequestInit
 */
export function withFetchTimeout(init: RequestInit, timeoutMs?: number): RequestInit {
  if (!timeoutMs || timeoutMs <= 0) return init;
  const signals: AbortSignal[] = [];
  if (init.signal) signals.push(init.signal);
  signals.push(AbortSignal.timeout(timeoutMs));
  return { ...init, signal: signals.length > 1 ? AbortSignal.any(signals) : signals[0] };
}
