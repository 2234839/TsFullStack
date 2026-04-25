import { Effect } from 'effect';
import { MsgError } from '../../util/error';
import { MSG } from '../../util/constants';
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
  /**
   * 获取指定平台的适配器
   *
   * 返回 Effect 而非 throw，确保在 Effect.gen 内部调用时错误走 Fail 而非 Die
   */
  getAdapter: (provider: PaymentProvider): Effect.Effect<PaymentAdapter, MsgError> => {
    const adapter = adapterMap.get(provider);
    if (!adapter) {
      return Effect.fail(MsgError.msg(`${MSG.PROVIDER_ADAPTER_NOT_FOUND}: ${provider}`));
    }
    return Effect.succeed(adapter);
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
