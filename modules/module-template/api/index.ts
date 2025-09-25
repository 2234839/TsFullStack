import { copyFile } from 'node:fs/promises';
export const api = {
  test() {
    copyFile;
  },
};

// Fibonacci 工具函数（已导出供外部使用）
export function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}