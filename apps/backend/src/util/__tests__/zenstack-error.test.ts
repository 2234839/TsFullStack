import { describe, it, expect } from "vite-plus/test";
import {
  isZenStackPermissionError,
  isZenStackValidationError,
  isRecordNotFoundError,
  createDetailedErrorMessage,
} from "../zenstack-error";

describe("isZenStackPermissionError", () => {
  it("识别 P2004 ACCESS_POLICY_VIOLATION", () => {
    const error = { code: "P2004", meta: { reason: "ACCESS_POLICY_VIOLATION" } };
    expect(isZenStackPermissionError(error)).toBe(true);
  });

  it("不识别 P2004 DATA_VALIDATION_VIOLATION", () => {
    const error = { code: "P2004", meta: { reason: "DATA_VALIDATION_VIOLATION" } };
    expect(isZenStackPermissionError(error)).toBe(false);
  });

  it("不识别非 P2004 错误", () => {
    expect(isZenStackPermissionError({ code: "P2003" })).toBe(false);
  });

  it("不识别 null/undefined/string", () => {
    expect(isZenStackPermissionError(null)).toBe(false);
    expect(isZenStackPermissionError(undefined)).toBe(false);
    expect(isZenStackPermissionError("error")).toBe(false);
  });
});

describe("isZenStackValidationError", () => {
  it("识别 P2004 DATA_VALIDATION_VIOLATION", () => {
    const error = { code: "P2004", meta: { reason: "DATA_VALIDATION_VIOLATION" } };
    expect(isZenStackValidationError(error)).toBe(true);
  });
});

describe("isRecordNotFoundError", () => {
  it("识别 P2025", () => {
    expect(isRecordNotFoundError({ code: "P2025" })).toBe(true);
  });

  it("不识别其他错误码", () => {
    expect(isRecordNotFoundError({ code: "P2004" })).toBe(false);
  });
});

describe("createDetailedErrorMessage", () => {
  it("ZenStack 权限错误输出正确", () => {
    const error = { code: "P2004", meta: { reason: "ACCESS_POLICY_VIOLATION" } };
    const msg = createDetailedErrorMessage(error, "test");
    expect(msg).toContain("ZenStack");
    expect(msg).toContain("ACCESS_POLICY_VIOLATION");
  });

  it("P2025 输出记录不存在", () => {
    const msg = createDetailedErrorMessage({ code: "P2025" }, "ctx");
    expect(msg).toContain("记录不存在");
  });

  it("普通错误输出原始消息", () => {
    const msg = createDetailedErrorMessage(new Error("boom"), "ctx");
    expect(msg).toContain("boom");
  });
});
