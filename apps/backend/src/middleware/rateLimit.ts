/**
 * 简单的内存速率限制器
 * 生产环境应使用 Redis 等分布式缓存
 *
 * 安全增强：
 * - 限制最大entry数量防止内存泄漏
 * - 使用LRU淘汰策略（O(1) 基于 Map 插入顺序）
 */
import { MS_PER_MINUTE } from '../util/constants';

/** 速率限制器最大记录数 */
const DEFAULT_MAX_RATE_LIMIT_ENTRIES = 10_000;

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private requests = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;
  private maxEntries: number;

  constructor(
    private maxRequests: number,
    private windowMs: number,
    maxEntries: number = DEFAULT_MAX_RATE_LIMIT_ENTRIES
  ) {
    this.maxEntries = maxEntries;
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, MS_PER_MINUTE);
  }

  /**
   * 检查是否允许请求
   * 利用 Map 插入顺序实现 LRU：每次访问时 delete + set 将 key 移到末尾
   */
  check(identifier: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry || now > entry.resetTime) {
      if (this.requests.size >= this.maxEntries) {
        this.evictLRU();
      }

      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    // LRU: 将 key 移到 Map 末尾
    this.requests.delete(identifier);
    this.requests.set(identifier, entry);

    if (entry.count >= this.maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: this.maxRequests - entry.count };
  }

  /** 淘汰最久未访问的 entry（Map 迭代顺序即 LRU 顺序，首位 = 最老） */
  private evictLRU() {
    const firstKey = this.requests.keys().next().value;
    if (firstKey !== undefined) {
      this.requests.delete(firstKey);
    }
  }

  /** 清理过期记录 */
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(key);
      }
    }

    while (this.requests.size > this.maxEntries) {
      this.evictLRU();
    }
  }

  /** 销毁定时器 */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.requests.clear();
  }

  /** 获取统计信息 */
  getStats() {
    return {
      totalEntries: this.requests.size,
      maxEntries: this.maxEntries,
    };
  }
}

/** 代币消耗速率限制参数 */
const TOKEN_CONSUME_MAX_REQUESTS = 10;
const TOKEN_CONSUME_WINDOW_MS = 60_000;

/**
 * 代币消耗速率限制器
 * 每用户每分钟最多 10 次代币消耗
 */
export const tokenConsumeRateLimiter = new RateLimiter(TOKEN_CONSUME_MAX_REQUESTS, TOKEN_CONSUME_WINDOW_MS);

/** 销毁速率限制器定时器（用于优雅关闭） */
export function destroyRateLimiter() {
  tokenConsumeRateLimiter.destroy();
}

