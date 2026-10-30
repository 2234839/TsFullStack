import { Context, Layer } from 'effect';

/** 代币定价配置：基础价格与各维度倍数，默认值即原硬编码定价 */
export interface PricingConfig {
  /** 图片基础价格（代币/张） */
  imageBasePrice: number;
  /** 尺寸倍数映射（未命中的尺寸回退 1） */
  sizeMultiplier: Record<string, number>;
  /** 服务商倍数映射（未命中的服务商回退 1） */
  providerMultiplier: Record<string, number>;
}

/** 默认定价（与历史硬编码值一致） */
export const defaultPricingConfig: PricingConfig = {
  imageBasePrice: 10,
  sizeMultiplier: {
    '512x512': 0.5,
    '1024x768': 0.75,
    '768x1024': 0.75,
    '1024x1024': 1,
    '1344x768': 1.25,
    '768x1344': 1.25,
    '864x1152': 1.5,
    '1152x864': 1.5,
    '2048x2048': 2,
  },
  providerMultiplier: {
    qwen: 1,
    dalle: 2,
    stability: 1.5,
    glm: 1.2,
  },
};

/**
 * 代币定价配置 Effect Context Tag
 *
 * 定价从代码常量迁入配置 Tag，运行时通过 provideService 注入；
 * 未注入时使用 defaultPricingConfig 的默认 Layer
 */
export class PricingConfigService extends Context.Service<PricingConfigService, PricingConfig>()(
  'PricingConfigService',
) {}

/** 默认定价 Layer */
export const PricingConfigLive = Layer.succeed(PricingConfigService, defaultPricingConfig);
