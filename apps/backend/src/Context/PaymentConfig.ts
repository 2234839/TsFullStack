import { Context } from 'effect';
import type { AppConfig } from './AppConfig';

/** 支付配置类型（从 AppConfig.payment 提取） */
export type PaymentConfig = NonNullable<AppConfig['payment']>;

/**
 * 支付配置 Effect Context Tag
 *
 * 从 AppConfig 中提取 payment 配置，在应用启动时通过 provideService 注入。
 * 支付相关模块（适配器、服务）通过 yield* PaymentConfigService 获取配置。
 */
export class PaymentConfigService extends Context.Tag('PaymentConfigService')<
  PaymentConfigService,
  PaymentConfig
>() {}
