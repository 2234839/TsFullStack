import { Effect } from 'effect';
import { fail } from '../../../util/error';
import { MSG } from '../../../util/constants';
import type {
  PaymentAdapter,
  CreatePaymentParams,
  CreatePaymentResult,
} from './types';
import { PaymentProvider } from '../../../../.zenstack/models';
import { PaymentConfigService } from '../../../Context/PaymentConfig';
import { ReqCtxService } from '../../../Context/ReqCtx';

const LOG_PREFIX = '[WechatAdapter]';

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
        return yield* fail(MSG.WECHAT_NOT_ENABLED);
      }

      reqCtx.log(LOG_PREFIX, '创建微信支付订单:', params.orderNo);

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
    fail(MSG.WECHAT_NO_WEBHOOK),

  queryOrderStatus: () =>
    Effect.succeed(null),
};
