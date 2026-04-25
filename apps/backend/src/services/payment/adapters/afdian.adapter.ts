import crypto from 'node:crypto';
import { Effect } from 'effect';
import { fail, tryOrFail } from '../../../util/error';
import { JSON_CONTENT_HEADERS, deepCloneToJson, MSG } from '../../../util/constants';
import { withFetchTimeout, FETCH_TIMEOUTS } from '../../../util/http';
import type {
  PaymentAdapter,
  CreatePaymentParams,
  CreatePaymentResult,
  ParsedWebhookResult,
} from './types';
import { PaymentProvider } from '../../../../.zenstack/models';
import { PaymentConfigService } from '../../../Context/PaymentConfig';
import { ReqCtxService } from '../../../Context/ReqCtx';

const LOG_PREFIX = '[AfdianAdapter]';

/**
 * 爱发电(AFDIAN)支付适配器
 *
 * 文档: https://guide.afdian.com/creator/developer
 * - 发起赞助: 跳转爱发电创作者页面
 * - Webhook: POST JSON {ec:200, data:{type:"order", order:{...}}}
 * - API签名: sign = md5(token + params + ts + user_id) （kv排序后无分隔符直接拼接）
 * - 订单查询: POST https://afdian.net/api/open/query-order
 *
 * 注意: 爱发电的模式更偏向"赞助"，createPayment 返回的是赞助页面 URL，
 * 实际金额确认依赖 Webhook 回调中的数据。
 */

const AFDIAN_API_BASE = 'https://afdian.net/api/open';

/** 爱发电 API 响应码 */
const AFDIAN_EC_SUCCESS = 200;

/** 爱发电订单状态：已支付 */
const AFDIAN_STATUS_PAID = 2;

/** 爱发电订单状态：已关闭 */
const AFDIAN_STATUS_CLOSED = -1;

/** 金额单位换算：元 → 分 */
const YUAN_TO_FEN = 100;

/** 爱发电订单状态 → 支付状态映射 */
const AFDIAN_STATUS_MAP: Record<number, ParsedWebhookResult['paymentStatus']> = {
  [AFDIAN_STATUS_PAID]: 'success',
  [AFDIAN_STATUS_CLOSED]: 'closed',
};

/** 生成爱发电 API 签名 */
function afdianSign(apiToken: string, params: string, ts: string, userId: string): string {
  const raw = `apiToken${apiToken}params${params}ts${ts}userId${userId}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

export const AfdianAdapter: PaymentAdapter = {
  provider: PaymentProvider.AFDIAN,

  createPayment: (params: CreatePaymentParams) =>
    Effect.gen(function* () {
      const config = yield* PaymentConfigService;
      const reqCtx = yield* ReqCtxService;
      const afdianConfig = config.afdian;

      if (!afdianConfig?.enabled || !afdianConfig.userId) {
        return yield* fail(MSG.AFDIAN_NOT_ENABLED);
      }

      // 爱发电使用"赞助方案"模式，返回赞助页面 URL
      // 使用 custom_order_id 传递订单号（官方支持的专用字段，用户不可改）
      // 文档: https://guide.afdian.com/creator/developer
      const sponsorUrl = `https://afdian.com/a/${afdianConfig.userId}?custom_order_id=${encodeURIComponent(params.orderNo)}`;

      reqCtx.log(LOG_PREFIX, '创建赞助链接:', params.orderNo);

      return {
        payUrl: sponsorUrl,
        providerData: { afdianUserId: afdianConfig.userId },
      } satisfies CreatePaymentResult;
    }),

  parseWebhook: (payload, _headers?) =>
    Effect.gen(function* () {
      const config = yield* PaymentConfigService;
      const reqCtx = yield* ReqCtxService;
      const afdianConfig = config.afdian;

      if (!afdianConfig) {
        return yield* fail(MSG.AFDIAN_NOT_CONFIGURED);
      }

      // 爱发电 Webhook 数据格式:
      // { ec: 200, em: "ok", data: { type: "order", order: { out_trade_no, total_amount, status, ... } } }
      const ec = Number(payload.ec);
      if (ec !== AFDIAN_EC_SUCCESS) {
        return yield* fail(`爱发电回调错误(ec=${ec}): ${String(payload.em ?? '')}`);
      }

      const data = payload.data as { type?: string; order?: Record<string, unknown> } | undefined;
      if (!data?.order) {
        return yield* fail(MSG.AFDIAN_WEBHOOK_EMPTY);
      }

      const order = data.order;
      const orderNo = String(order.custom_order_id ?? order.out_trade_no ?? order.remark ?? '');
      const status = Number(order.status);

      reqCtx.log(LOG_PREFIX, '收到回调:', orderNo, 'status:', status);

      return {
        tradeNo: String(order.order_id ?? ''),
        orderNo,
        paidAmount: Math.round(Number(order.total_amount ?? 0) * YUAN_TO_FEN),
        paymentStatus: AFDIAN_STATUS_MAP[status] ?? 'other',
        paidAt: new Date(),
        rawPayload: deepCloneToJson(payload),
      } satisfies ParsedWebhookResult;
    }),

  queryOrderStatus: (orderNo) =>
    Effect.gen(function* () {
      const config = yield* PaymentConfigService;
      const afdianConfig = config.afdian;

      if (!afdianConfig?.apiKey || !afdianConfig.apiUserId) return null;

      const ts = Math.floor(Date.now() / 1000).toString();
      const params = JSON.stringify({ out_trade_no: orderNo });
      const sign = afdianSign(afdianConfig.apiKey, params, ts, afdianConfig.apiUserId);

      const response = yield* tryOrFail('爱发电查询', () =>
          fetch(`${AFDIAN_API_BASE}/query-order`, withFetchTimeout({
            method: 'POST',
            headers: JSON_CONTENT_HEADERS,
            body: JSON.stringify({ user_id: afdianConfig.apiUserId, params, ts, sign }),
          }, FETCH_TIMEOUTS.payment)).then((r) => r.json()));

      const data = response as { ec?: number; data?: { list?: Array<{ out_trade_no?: string; total_amount?: string; status?: number }> } };
      if (data.ec !== AFDIAN_EC_SUCCESS || !data.data?.list?.length) return null;

      const found = data.data.list.find((o) => o.out_trade_no === orderNo);
      if (!found) return null;

      return {
        tradeNo: orderNo,
        status: found.status === AFDIAN_STATUS_PAID ? 'success' : 'pending',
        paidAmount: Math.round(Number(found.total_amount ?? 0) * YUAN_TO_FEN),
      };
    }),
};
