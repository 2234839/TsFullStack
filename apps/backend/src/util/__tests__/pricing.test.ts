import { describe, it, expect } from "vite-plus/test";
import { TokenPricingCalculator } from "../../services/TokenPricingCalculator";

describe("TokenPricingCalculator.aiImageGeneration", () => {
  it("标准尺寸 + 通义千问 = 10 代币/张", () => {
    const result = TokenPricingCalculator.aiImageGeneration({
      count: 1,
      size: "1024x1024",
      provider: "qwen",
    });
    expect(result.total).toBe(10);
  });

  it("大尺寸倍数为 2x", () => {
    const result = TokenPricingCalculator.aiImageGeneration({
      count: 1,
      size: "2048x2048",
      provider: "qwen",
    });
    expect(result.total).toBe(20);
  });

  it("DALL-E 服务商倍数为 2x", () => {
    const result = TokenPricingCalculator.aiImageGeneration({
      count: 1,
      size: "1024x1024",
      provider: "dalle",
    });
    expect(result.total).toBe(20);
  });

  it("多张图片正确计算总数", () => {
    const result = TokenPricingCalculator.aiImageGeneration({
      count: 3,
      size: "1024x1024",
      provider: "qwen",
    });
    expect(result.total).toBe(30);
  });

  it("结果包含 breakdown 和 details", () => {
    const result = TokenPricingCalculator.aiImageGeneration({
      count: 2,
      size: "512x512",
      provider: "stability",
    });
    expect(result.breakdown).toContain("stability");
    expect(result.details.basePrice).toBe(10);
    expect(result.details.multipliers.count).toBe(2);
  });

  it("count 为 0 时抛出错误", () => {
    expect(() =>
      TokenPricingCalculator.aiImageGeneration({
        count: 0,
        size: "1024x1024",
        provider: "qwen",
      }),
    ).toThrow();
  });

  it("count 为负数时抛出错误", () => {
    expect(() =>
      TokenPricingCalculator.aiImageGeneration({
        count: -1,
        size: "1024x1024",
        provider: "qwen",
      }),
    ).toThrow();
  });

  it("count 为 NaN 时抛出错误", () => {
    expect(() =>
      TokenPricingCalculator.aiImageGeneration({
        count: NaN,
        size: "1024x1024",
        provider: "qwen",
      }),
    ).toThrow();
  });

  it("未知尺寸使用默认倍数 1", () => {
    const result = TokenPricingCalculator.aiImageGeneration({
      count: 1,
      size: "999x999",
      provider: "qwen",
    });
    expect(result.total).toBe(10);
  });

  it("小尺寸倍数为 0.5x，向上取整", () => {
    const result = TokenPricingCalculator.aiImageGeneration({
      count: 1,
      size: "512x512",
      provider: "qwen",
    });
    expect(result.total).toBe(5);
  });
});
