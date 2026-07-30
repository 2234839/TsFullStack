import { describe, it, expect } from "vite-plus/test";
import { LRUCache } from "../lruCache";

describe("LRUCache", () => {
  it("基础 get/set", () => {
    const cache = new LRUCache<string, number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBeUndefined();
    expect(cache.size()).toBe(2);
  });

  it("超过容量时淘汰最久未访问的条目", () => {
    const cache = new LRUCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3); // a 应被淘汰
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  it("get 操作将条目移到末尾（最近使用）", () => {
    const cache = new LRUCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // a 变为最近使用
    cache.set("c", 3); // b 应被淘汰（非 a）
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });

  it("set 已存在的 key 更新值并移到末尾", () => {
    const cache = new LRUCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 10); // 更新 a 并移到末尾
    cache.set("c", 3); // b 应被淘汰
    expect(cache.get("a")).toBe(10);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });

  it("cleanUp 清除过期条目", () => {
    const cache = new LRUCache<string, { val: number; expiresAt: number }>(10);
    const now = Date.now();
    cache.set("a", { val: 1, expiresAt: now - 1000 });
    cache.set("b", { val: 2, expiresAt: now + 10000 });
    cache.set("c", { val: 3, expiresAt: now - 500 });
    const cleaned = cache.cleanUp((entry) => entry.expiresAt < now);
    expect(cleaned).toBe(2);
    expect(cache.size()).toBe(1);
    expect(cache.get("b")?.val).toBe(2);
  });

  it("clear 清空所有条目", () => {
    const cache = new LRUCache<string, number>(5);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });

  it("容量为 1 时正确工作", () => {
    const cache = new LRUCache<string, number>(1);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    cache.set("b", 2);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
  });
});
