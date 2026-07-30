import { describe, it, expect } from "vite-plus/test";
import { deepCloneToJson } from "../constants";

describe("deepCloneToJson", () => {
  it("深拷贝普通对象", () => {
    const original = { a: 1, b: "hello", c: true };
    const cloned = deepCloneToJson(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  it("深拷贝嵌套对象", () => {
    const original = { user: { name: "test", age: 25 } };
    const cloned = deepCloneToJson(original);
    expect(cloned).toEqual(original);
    expect(cloned.user).not.toBe(original.user);
  });

  it("去除 JSON 不安全的值", () => {
    const original = {
      a: 1,
      fn: () => {},
      undef: undefined,
      date: new Date("2025-01-01"),
    };
    const cloned = deepCloneToJson(original);
    expect(cloned.a).toBe(1);
    expect(cloned.fn).toBeUndefined();
    expect(cloned.undef).toBeUndefined();
    expect(typeof cloned.date).toBe("string");
  });

  it("数组正确拷贝", () => {
    const original = [1, "two", { three: 3 }];
    const cloned = deepCloneToJson(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });
});
