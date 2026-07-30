import { describe, it, expect } from "vite-plus/test";
import { hashPassword, comparePassword } from "../crypto";
import { Effect } from "effect";
import { MsgError } from "../error";

describe("hashPassword + comparePassword", () => {
  it("密码哈希后可以正确验证", async () => {
    const hashed = await Effect.runPromise(hashPassword("mypassword"));
    expect(typeof hashed).toBe("string");
    expect(hashed).not.toBe("mypassword");

    const match = await Effect.runPromise(comparePassword("mypassword", hashed));
    expect(match).toBe(true);
  });

  it("错误密码验证失败", async () => {
    const hashed = await Effect.runPromise(hashPassword("correct"));
    const match = await Effect.runPromise(comparePassword("wrong", hashed));
    expect(match).toBe(false);
  });

  it("相同密码产生不同哈希值（salt 随机）", async () => {
    const hash1 = await Effect.runPromise(hashPassword("same"));
    const hash2 = await Effect.runPromise(hashPassword("same"));
    expect(hash1).not.toBe(hash2);
  });

  it("空字符串可以哈希", async () => {
    const hashed = await Effect.runPromise(hashPassword(""));
    const match = await Effect.runPromise(comparePassword("", hashed));
    expect(match).toBe(true);
  });
});
