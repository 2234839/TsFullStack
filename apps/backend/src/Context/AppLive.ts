import { Effect, Layer } from 'effect';
import { loadAppConfig } from '../config/loader';
import { AIConfigContext, DefaultAIConfig } from './AIConfig';
import { AIProxyService, AIProxyServiceLive } from './AIProxyService';
import { AppConfigService } from './AppConfig';
import { PaymentConfigService } from './PaymentConfig';
import { PricingConfigLive } from './PricingConfig';
import { LocalKVStoreLive } from './KVStore';

/** 配置层：从 config.json 加载并注入 AppConfigService */
export const ConfigLive = Layer.effect(AppConfigService, loadAppConfig);

/** 支付配置层：从 AppConfigService 派生 PaymentConfigService */
export const PaymentConfigLive = Layer.effect(
  PaymentConfigService,
  Effect.map(AppConfigService, (config) => config.payment ?? {}),
);

/** AI 配置层：静态默认配置 */
export const AIConfigLive = Layer.effect(AIConfigContext, Effect.succeed(DefaultAIConfig));

/** AI 代理服务层：静态实现对象 */
export const AIProxyLive = Layer.effect(AIProxyService, Effect.succeed(AIProxyServiceLive));

/** 应用主 Layer 树：入口只需一次 Effect.provide(program, AppLive) */
export const AppLive = Layer.mergeAll(
  ConfigLive,
  /** PaymentConfigLive 依赖 AppConfigService，用 provideMerge 注入依赖并保留两组服务 */
  PaymentConfigLive.pipe(Layer.provideMerge(ConfigLive)),
  AIConfigLive,
  AIProxyLive,
  PricingConfigLive,
  /** 安全状态 KV 接口层（当前单实例内存实现，切多实例换 RedisKVStore） */
  LocalKVStoreLive,
);
