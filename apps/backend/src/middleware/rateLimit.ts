/**
 * 简单的内存速率限制器
 * 生产环境应使用 Redis 等分布式缓存
 *
 * 安全增强：
 * - 限制最大entry数量防止内存泄漏
 * - 使用LRU淘汰策略
 */
import { MS_PER_MINUTE } from '../util/constants';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number;
}

class RateLimiter {
  private requests = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;
  private maxEntries: number;

  constructor(
    private maxRequests: number,
    private windowMs: number,
    maxEntries: number = 10000 // 默认最多保存10000个用户的记录
  ) {
    this.maxEntries = maxEntries;
    // 每分钟清理一次过期记录
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, MS_PER_MINUTE);
  }

  /**
   * 检查是否允许请求
   * 注意：由于JavaScript单线程特性，不需要显式锁
   */
  check(identifier: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry || now > entry.resetTime) {
      // 创建新窗口
      // 检查是否超过最大entry数量，使用LRU淘汰
      if (this.requests.size >= this.maxEntries) {
        this.evictLRU();
      }

      const resetTime = now + this.windowMs;
      this.requests.set(identifier, {
        count: 1,
        resetTime,
        lastAccess: now,
      });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    // 更新最后访问时间
    entry.lastAccess = now;

    if (entry.count >= this.maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: this.maxRequests - entry.count };
  }

  /**
   * 淘汰最近最少使用的entry
   */
  private evictLRU() {
    let oldestKey: string | null = null;
    /** 使用 Infinity 确保第一个 entry 总是满足淘汰条件（防止同毫秒批量创建导致死循环） */
    let oldestTime = Infinity;

    for (const [key, entry] of this.requests.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.requests.delete(oldestKey);
    }
  }

  /**
   * 清理过期记录
   */
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(key);
      }
    }

    // 如果仍然超过最大数量，继续淘汰LRU
    while (this.requests.size > this.maxEntries) {
      this.evictLRU();
    }
  }

  /**
   * 销毁定时器
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.requests.clear();
  }

  /**
   * 获取统计信息（用于监控）
   */
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

