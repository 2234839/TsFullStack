/**
 * 通用 LRU (Least Recently Used) 缓存
 *
 * 基于 Map 插入顺序实现 O(1) 读写与淘汰：
 * - 最近访问的条目在末尾（delete + set 移至尾部）
 * - 最久未访问的在头部（keys().next().value 即为淘汰目标）
 *
 * 适用场景：用户鉴权缓存、速率限制器等需要控制内存占用的场景。
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  /**
   * 获取缓存值
   * 命中时将条目移到末尾（标记为最近使用）
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  /**
   * 设置缓存值
   * 超过容量时自动淘汰最久未使用的条目
   */
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  /**
   * 清理过期条目
   * @returns 清理的条目数量
   */
  cleanUp(isExpired: (value: V) => boolean): number {
    let cleaned = 0;
    for (const [key, value] of this.cache.entries()) {
      if (isExpired(value)) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }

  /** 获取当前缓存条目数 */
  size(): number {
    return this.cache.size;
  }

  /** 清空所有条目 */
  clear(): void {
    this.cache.clear();
  }
}
