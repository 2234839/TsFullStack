import type { PaymentAdapter } from './adapters/types';
import { PaymentProvider } from '../../../.zenstack/models';
import { MbdAdapter } from './adapters/mbd.adapter';
import { AfdianAdapter } from './adapters/afdian.adapter';
import { WechatAdapter } from './adapters/wechat.adapter';

/** 已注册的适配器映射 */
const adapterMap = new Map<PaymentProvider, PaymentAdapter>([
  [PaymentProvider.MBD, MbdAdapter],
  [PaymentProvider.AFDIAN, AfdianAdapter],
  [PaymentProvider.WECHAT, WechatAdapter],
]);

/**
 * 支付适配器注册中心
 *
 * 根据 PaymentProvider 枚举值获取对应的适配器实例。
 * 新增支付平台只需：(1) 实现 PaymentAdapter 接口 (2) 在此处注册 (3) 添加 webhook 路由
 */
export const PaymentAdapterRegistry = {
  /** 获取指定平台的适配器 */
  getAdapter: (provider: PaymentProvider): PaymentAdapter => {
    const adapter = adapterMap.get(provider);
    if (!adapter) {
      throw Error(`未找到支付平台适配器: ${provider}`);
    }
    return adapter;
  },

  /** 获取所有已注册的适配器（用于遍历/Webhook路由分发） */
  getAllAdapters: (): ReadonlyMap<PaymentProvider, PaymentAdapter> => adapterMap,

  /**
   * 运行时动态注册新适配器
   *
   * @example
   * ```ts
   * import { StripeAdapter } from './adapters/stripe.adapter';
   * PaymentAdapterRegistry.register(StripeAdapter);
   * ```
   */
  register: (adapter: PaymentAdapter) => {
    adapterMap.set(adapter.provider, adapter);
  },
};
