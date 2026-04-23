import crypto from 'node:crypto';
import { Effect } from 'effect';
import type {
  PaymentAdapter,
  CreatePaymentParams,
  CreatePaymentResult,
  ParsedWebhookResult,
} from './types';
import { PaymentProvider } from '../../../../.zenstack/models';
import { PaymentConfigService } from '../../../Context/PaymentConfig';
import { ReqCtxService } from '../../../Context/ReqCtx';

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
        throw Error('爱发电未启用或缺少配置(userId)');
      }

      // 爱发电使用"赞助方案"模式，返回赞助页面 URL
      // 使用 custom_order_id 传递订单号（官方支持的专用字段，用户不可改）
      // 文档: https://guide.afdian.com/creator/developer
      const sponsorUrl = `https://afdian.com/a/${afdianConfig.userId}?custom_order_id=${encodeURIComponent(params.orderNo)}`;

      reqCtx.log('[AfdianAdapter] 创建赞助链接:', params.orderNo);

      return {
        payUrl: sponsorUrl,
        providerData: { afdianUserId: afdianConfig.userId },
      } satisfies CreatePaymentResult;
    }),

  parseWebhook: (payload, headers?) =>
    Effect.gen(function* () {
      const config = yield* PaymentConfigService;
      const reqCtx = yield* ReqCtxService;
      const afdianConfig = config.afdian;

      if (!afdianConfig) {
        throw Error('爱发电未配置');
      }

      // 爱发电 Webhook 数据格式:
      // { ec: 200, em: "ok", data: { type: "order", order: { out_trade_no, total_amount, status, ... } } }
      const ec = payload.ec as number;
      if (ec !== 200) {
        throw Error(`爱发电回调错误(ec=${ec}): ${(payload.em as string) ?? ''}`);
      }

      const data = payload.data as { type?: string; order?: Record<string, unknown> } | undefined;
      if (!data?.order) {
        throw Error('爱发电回调数据为空');
      }

      const order = data.order;
      const orderNo = (order.custom_order_id ?? order.out_trade_no ?? order.remark) as string;
      const status = order.status as number;

      reqCtx.log('[AfdianAdapter] 收到回调:', orderNo, 'status:', status);

      return {
        tradeNo: (order.order_id as string) ?? '',
        orderNo,
        paidAmount: Math.round(Number(order.total_amount ?? 0) * 100), // 元转分
        paymentStatus: status === 2 ? 'success' : status === -1 ? 'closed' : 'other',
        paidAt: new Date(),
        rawPayload: JSON.parse(JSON.stringify(payload)),
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

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(`${AFDIAN_API_BASE}/query-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: afdianConfig.apiUserId, params, ts, sign }),
          }).then((r) => r.json()),
        catch: (e) => Error(`爱发电查询失败: ${String(e)}`),
      });

      const data = response as { ec?: number; data?: { list?: Array<{ out_trade_no?: string; total_amount?: string; status?: number }> } };
      if (data.ec !== 200 || !data.data?.list?.length) return null;

      const found = data.data.list.find((o) => o.out_trade_no === orderNo);
      if (!found) return null;

      return {
        tradeNo: orderNo,
        status: found.status === 2 ? 'success' : 'pending',
        paidAmount: Math.round(Number(found.total_amount ?? 0) * 100),
      };
    }),
};
