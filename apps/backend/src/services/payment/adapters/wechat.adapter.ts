import { Effect } from 'effect';
import type {
  PaymentAdapter,
  CreatePaymentParams,
  CreatePaymentResult,
} from './types';
import { PaymentProvider } from '../../../../.zenstack/models';
import { PaymentConfigService } from '../../../Context/PaymentConfig';
import { ReqCtxService } from '../../../Context/ReqCtx';

/**
 * 微信好友支付适配器
 *
 * 不对接任何第三方支付网关，createPayment 返回特殊 payUrl 标识，
 * 前端据此判断打开引导面板（显示微信号+订单信息）而非跳转外部页面。
 * 确认到账走管理端手动操作，不使用 webhook 和主动查询。
 */

/** 微信支付专用 payUrl 标识，前端据此判断展示引导面板 */
export const WECHAT_PAY_URL = 'wechat://manual';

export const WechatAdapter: PaymentAdapter = {
  provider: PaymentProvider.WECHAT,

  createPayment: (params: CreatePaymentParams) =>
    Effect.gen(function* () {
      const config = yield* PaymentConfigService;
      const reqCtx = yield* ReqCtxService;
      const wechatConfig = config.wechat;

      if (!wechatConfig?.enabled || !wechatConfig.accountId) {
        throw Error('微信好友支付未启用或缺少微信号配置');
      }

      reqCtx.log('[WechatAdapter] 创建微信支付订单:', params.orderNo);

      return {
        payUrl: WECHAT_PAY_URL,
        providerData: {
          wechatAccountId: wechatConfig.accountId,
          wechatAccountName: wechatConfig.accountName ?? '',
          orderNo: params.orderNo,
          amount: params.amount,
          subject: params.subject,
        },
      } satisfies CreatePaymentResult;
    }),

  parseWebhook: () =>
    Effect.gen(function* () {
      throw Error('微信好友支付不支持 Webhook 回调');
    }),

  queryOrderStatus: () =>
    Effect.gen(function* () {
      return null;
    }),
};
