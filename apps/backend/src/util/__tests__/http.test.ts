import { describe, it, expect } from 'vitest';
import { withFetchTimeout } from '../http';

describe('withFetchTimeout', () => {
  it('无超时时返回原始 init', () => {
    const init: RequestInit = { method: 'GET' };
    expect(withFetchTimeout(init)).toBe(init);
  });

  it('超时为 0 时返回原始 init', () => {
    const init: RequestInit = { method: 'GET' };
    expect(withFetchTimeout(init, 0)).toBe(init);
  });

  it('负数超时返回原始 init', () => {
    const init: RequestInit = { method: 'GET' };
    expect(withFetchTimeout(init, -100)).toBe(init);
  });

  it('设置超时时注入 signal', () => {
    const init: RequestInit = { method: 'GET' };
    const result = withFetchTimeout(init, 5000);
    expect(result).not.toBe(init);
    expect(result.signal).toBeInstanceOf(AbortSignal);
  });

  it('已有 signal 时合并为 AbortSignal.any', () => {
    const controller = new AbortController();
    const init: RequestInit = { method: 'GET', signal: controller.signal };
    const result = withFetchTimeout(init, 5000);
    expect(result.signal).toBeInstanceOf(AbortSignal);
    /** 合并后的 signal 不应等于原始 signal */
    expect(result.signal).not.toBe(controller.signal);
  });
});
