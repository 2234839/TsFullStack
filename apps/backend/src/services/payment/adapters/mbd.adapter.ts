import crypto from 'node:crypto';
import { Effect } from 'effect';
import { fail, MsgError, tryOrFail, extractErrorMessage } from '../../../util/error';
import { JSON_CONTENT_HEADERS, deepCloneToJson, MSG } from '../../../util/constants';
import { withFetchTimeout, FETCH_TIMEOUTS } from '../../../util/http';
import type {
  PaymentAdapter,
  CreatePaymentParams,
  CreatePaymentResult,
} from './types';
import { PaymentProvider } from '../../../../.zenstack/models';
import { PaymentConfigService } from '../../../Context/PaymentConfig';
import { ReqCtxService } from '../../../Context/ReqCtx';

const LOG_PREFIX = '[MbdAdapter]';

/**
 * 面包多(MBD)支付适配器
 *
 * 文档: https://doc.mbd.pub/api/
 * - 支付宝支付: POST https://newapi.mbd.pub/release/alipay/pay
 * - 微信H5支付: POST https://newapi.mbd.pub/release/wx/prepay
 * - 签名算法: ksort → key=value&拼接 → &key={appKey} → MD5
 * - Webhook: POST JSON {type:"charge_succeeded", data:{out_trade_no, amount, charge_id, payway}}
 * - 订单查询: POST https://newapi.mbd.pub/release/main/search_order
 */

const MBD_API_BASE = 'https://newapi.mbd.pub';

/** 面包多订单状态：支付成功 */
const MBD_STATE_SUCCESS = '1';

/** 生成面包多签名 */
function mbdSign(params: Record<string, unknown>, appKey: string): string {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('md5').update(`${sorted}&key=${appKey}`).digest('hex');
}

export const MbdAdapter: PaymentAdapter = {
  provider: PaymentProvider.MBD,

  createPayment: (params: CreatePaymentParams) =>
    Effect.gen(function* () {
      const config = yield* PaymentConfigService;
      const reqCtx = yield* ReqCtxService;
      const mbdConfig = config.mbd;

      if (!mbdConfig?.enabled || !mbdConfig.appId || !mbdConfig.appKey) {
        return yield* fail(MSG.MBD_NOT_ENABLED);
      }

      const signParams = {
        app_id: mbdConfig.appId,
        amount_total: params.amount,
        out_trade_no: params.orderNo,
        description: params.subject,
        url: params.returnUrl ?? '',
        callback_url: params.notifyUrl,
      };
      const sign = mbdSign(signParams, mbdConfig.appKey);

      // 使用支付宝接口（PC/H5通用，返回 HTML form 自动提交）
      const result = yield* Effect.tryPromise({
        try: async () => {
          const response = await fetch(`${MBD_API_BASE}/release/alipay/pay`, withFetchTimeout({
            method: 'POST',
            headers: JSON_CONTENT_HEADERS,
            body: JSON.stringify({ ...signParams, sign }),
          }, FETCH_TIMEOUTS.payment));
          const data = (await response.json()) as { error?: string; body?: string; h5_url?: string };
          if (data.error) throw MsgError.msg(`面包多API错误: ${data.error}`);
          return data;
        },
        catch: (e) => MsgError.msg(`面包多创建支付失败: ${extractErrorMessage(e)}`),
      });

      reqCtx.log(LOG_PREFIX, '创建支付单:', params.orderNo);

      // 返回 payUrl：优先使用 h5_url，否则返回 form HTML 用 data URI
      const payUrl = result.h5_url ?? `data:text/html;base64,${Buffer.from(result.body ?? '').toString('base64')}`;

      return {
        payUrl,
        providerData: { mbdOutTradeNo: params.orderNo },
      } satisfies CreatePaymentResult;
    }),

  parseWebhook: (payload) =>
    Effect.gen(function* () {
      const reqCtx = yield* ReqCtxService;

      // 面包多 Webhook 格式:
      // { type: "charge_succeeded" | "complaint", data: { out_trade_no, amount, charge_id, payway } }
      const type = String(payload.type);
      const data = payload.data as Record<string, unknown> | undefined;

      if (type === 'complaint') {
        reqCtx.log(LOG_PREFIX, '收到投诉通知:', String(data?.out_trade_no ?? ''));
        return {
          tradeNo: '',
          orderNo: String(data?.out_trade_no ?? ''),
          paidAmount: Number(data?.amount ?? 0),
          paymentStatus: 'other' as const,
          paidAt: new Date(),
          rawPayload: deepCloneToJson(payload),
        };
      }

      if (type !== 'charge_succeeded') {
        return yield* fail(`未知的通知类型: ${type}`);
      }

      reqCtx.log(LOG_PREFIX, '收到支付成功回调:', String(data?.out_trade_no ?? ''));

      return {
        tradeNo: String(data?.charge_id ?? ''),
        orderNo: String(data?.out_trade_no ?? ''),
        paidAmount: Number(data?.amount ?? 0),
        paymentStatus: 'success',
        paidAt: new Date(),
        rawPayload: deepCloneToJson(payload),
      };
    }),

  queryOrderStatus: (orderNo) =>
    Effect.gen(function* () {
      const response = yield* tryOrFail('面包多查询', () => fetch(`${MBD_API_BASE}/release/main/search_order`, {
        method: 'POST',
        headers: JSON_CONTENT_HEADERS,
        body: JSON.stringify({ out_trade_no: orderNo }),
      }).then((r) => r.json()));

      const data = response as { error?: string; order_id?: string; state?: string; amount?: string };
      if (data.error || !data.order_id) return null;

      return {
        tradeNo: data.order_id,
        status: data.state === MBD_STATE_SUCCESS ? 'success' : 'pending',
        paidAmount: Number(data.amount ?? 0),
      };
    }),
};
