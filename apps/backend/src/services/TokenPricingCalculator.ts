/**
 * 代币价格计算器
 *
 * 设计理念：代码即配置
 * - 所有代币消耗逻辑都在代码中明确声明
 * - 每次计算都有清晰的公式和原因
 * - 便于测试、维护和版本控制
 */

/** AI 图片生成选项 */
interface AiImageOptions {
  /** 生成数量 */
  count: number;
  /** 图片尺寸 */
  size: string;
  /** 服务商 */
  provider: 'qwen' | 'dalle' | 'stability' | 'glm';
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

/** AI 文本生成使用量 */
interface AiTextUsage {
  /** 输入 token 数 */
  inputTokens: number;
  /** 输出 token 数 */
  outputTokens: number;
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

  /** 文本模型价格表（代币/1000 tokens） */
  private static readonly TEXT_PRICES: Record<string, { input: number; output: number }> = {
    'gpt-4': { input: 5, output: 10 },
    'gpt-3.5-turbo': { input: 1, output: 2 },
    'claude-3': { input: 3, output: 8 },
    'qwen-turbo': { input: 0.5, output: 1 },
  };

  /** 视频分辨率倍数映射 */
  private static readonly RESOLUTION_MULTIPLIER: Record<string, number> = {
    '720p': 1,
    '1080p': 2,
    '4k': 4,
  };

  /** 翻译基础费用（代币） */
  private static readonly TRANSLATION_BASE_FEE = 2;

  /** 视频基础价格（代币/秒） */
  private static readonly VIDEO_BASE_PRICE_PER_SECOND = 50;
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
    const sizeMult = TokenPricingCalculator.SIZE_MULTIPLIER[options.size] || 1;
    const providerMult = TokenPricingCalculator.PROVIDER_MULTIPLIER[options.provider] || 1;

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

  /**
   * AI 文本生成代币计算（按实际 token 使用量）
   *
   * 定价策略：
   * - 根据不同模型类型有不同的 token 价格
   * - 输入 token 和输出 token 分别计费
   * - 价格单位：代币/1000 tokens
   *
   * @param usage token 使用情况
   * @param modelType 模型类型
   * @returns 代币消耗计算结果
   */
  static aiTextGeneration(
    usage: AiTextUsage,
    modelType: 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3' | 'qwen-turbo'
  ): TokenCostResult {
    const price = TokenPricingCalculator.TEXT_PRICES[modelType] || { input: 1, output: 2 };

    const inputCost = Math.ceil((usage.inputTokens / 1000) * price.input);
    const outputCost = Math.ceil((usage.outputTokens / 1000) * price.output);
    const total = inputCost + outputCost;

    const breakdown = `AI文本生成: ${modelType} (${usage.inputTokens}输入 + ${usage.outputTokens}输出)`;
    const formula = `⌈${usage.inputTokens}/1000 × ${price.input}⌉ + ⌈${usage.outputTokens}/1000 × ${price.output}⌉ = ${inputCost} + ${outputCost} = ${total}`;

    return {
      total,
      breakdown,
      details: {
        basePrice: 0,
        multipliers: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          inputPricePer1k: price.input,
          outputPricePer1k: price.output,
        },
        formula,
      },
    };
  }

  /**
   * AI 翻译代币计算
   *
   * 定价策略：
   * - 基础费用：每次翻译 2 代币
   * - 按字符数计费：每1000字符 1 代币
   *
   * @param textLength 翻译文本长度
   * @param sourceLanguage 源语言
   * @param targetLanguage 目标语言
   * @returns 代币消耗计算结果
   */
  static aiTranslation(
    textLength: number,
    sourceLanguage: string,
    targetLanguage: string
  ): TokenCostResult {
    const charPrice = 1;
    const charCost = Math.ceil((textLength / 1000) * charPrice);
    const total = TokenPricingCalculator.TRANSLATION_BASE_FEE + charCost;

    const breakdown = `AI翻译: ${sourceLanguage}→${targetLanguage} (${textLength}字符)`;
    const formula = `${TokenPricingCalculator.TRANSLATION_BASE_FEE}(基础) + ⌈${textLength}/1000 × ${charPrice}⌉ = ${TokenPricingCalculator.TRANSLATION_BASE_FEE} + ${charCost} = ${total}`;

    return {
      total,
      breakdown,
      details: {
        basePrice: TokenPricingCalculator.TRANSLATION_BASE_FEE,
        multipliers: {
          textLength: textLength,
          pricePer1kChars: charPrice,
        },
        formula,
      },
    };
  }

  /**
   * 视频生成代币计算（未来功能）
   *
   * 定价策略：
   * - 基础价格：50 代币/秒
   * - 分辨率倍数：720p 1x, 1080p 2x, 4K 4x
   *
   * @param duration 视频时长（秒）
   * @param resolution 分辨率
   * @returns 代币消耗计算结果
   */
  static aiVideoGeneration(duration: number, resolution: '720p' | '1080p' | '4k'): TokenCostResult {
    const resMult = TokenPricingCalculator.RESOLUTION_MULTIPLIER[resolution] || 1;
    const total = Math.ceil(TokenPricingCalculator.VIDEO_BASE_PRICE_PER_SECOND * duration * resMult);

    const breakdown = `AI视频生成: ${resolution} ${duration}秒`;
    const formula = `${TokenPricingCalculator.VIDEO_BASE_PRICE_PER_SECOND} × ${duration} × ${resMult}(分辨率) = ${total}`;

    return {
      total,
      breakdown,
      details: {
        basePrice: TokenPricingCalculator.VIDEO_BASE_PRICE_PER_SECOND,
        multipliers: {
          duration: duration,
          resolution: resMult,
        },
        formula,
      },
    };
  }
}
