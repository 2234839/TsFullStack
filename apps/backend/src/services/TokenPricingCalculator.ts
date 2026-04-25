/**
 * 代币价格计算器
 *
 * 设计理念：代码即配置
 * - 所有代币消耗逻辑都在代码中明确声明
 * - 每次计算都有清晰的公式和原因
 * - 便于测试、维护和版本控制
 */

import type { AiImageProvider } from '../util/constants';

/** AI 图片生成选项 */
interface AiImageOptions {
  /** 生成数量 */
  count: number;
  /** 图片尺寸 */
  size: string;
  /** 服务商 */
  provider: AiImageProvider;
}

/** 代币消耗计算结果 */
interface TokenCostResult {
  /** 总代币消耗 */
  total: number;
  /** 计算说明（用于日志和审计） */
  breakdown: string;
  /** 详细计算过程 */
  details: {
    basePrice: number;
    multipliers: Record<string, number>;
    formula: string;
  };
}

/** 代币价格计算器 */
export class TokenPricingCalculator {
  /** 图片基础价格（代币/张） */
  private static readonly IMAGE_BASE_PRICE = 10;

  /** 尺寸倍数映射 */
  private static readonly SIZE_MULTIPLIER: Record<string, number> = {
    '512x512': 0.5,
    '1024x768': 0.75,
    '768x1024': 0.75,
    '1024x1024': 1,
    '1344x768': 1.25,
    '768x1344': 1.25,
    '864x1152': 1.5,
    '1152x864': 1.5,
    '2048x2048': 2,
  };

  /** 服务商倍数映射 */
  private static readonly PROVIDER_MULTIPLIER: Record<string, number> = {
    qwen: 1,
    dalle: 2,
    stability: 1.5,
    glm: 1.2,
  };

  /**
   * AI 图片生成代币计算
   *
   * 定价策略：
   * - 基础价格：10 代币/张
   * - 尺寸倍数：小尺寸(512x512) 0.5x，标准(1024x1024) 1x，大尺寸(2048x2048) 2x
   * - 服务商倍数：通义千问 1x，DALL-E 2x，Stability 1.5x
   *
   * @param options 图片生成选项
   * @returns 代币消耗计算结果
   */
  static aiImageGeneration(options: AiImageOptions): TokenCostResult {
    const sizeMult = TokenPricingCalculator.SIZE_MULTIPLIER[options.size] ?? 1;
    const providerMult = TokenPricingCalculator.PROVIDER_MULTIPLIER[options.provider] ?? 1;

    const total = Math.ceil(TokenPricingCalculator.IMAGE_BASE_PRICE * options.count * sizeMult * providerMult);

    const breakdown = `AI图片生成: ${options.provider} ${options.size} x${options.count}`;
    const formula = `${TokenPricingCalculator.IMAGE_BASE_PRICE} × ${options.count} × ${sizeMult}(尺寸) × ${providerMult}(服务商) = ${total}`;

    return {
      total,
      breakdown,
      details: {
        basePrice: TokenPricingCalculator.IMAGE_BASE_PRICE,
        multipliers: {
          count: options.count,
          size: sizeMult,
          provider: providerMult,
        },
        formula,
      },
    };
  }
}
