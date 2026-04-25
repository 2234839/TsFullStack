import type { Effect } from 'effect';
import type { PaymentProvider } from '../../../../.zenstack/models';
import type { PaymentConfigService } from '../../../Context/PaymentConfig';
import type { ReqCtxService } from '../../../Context/ReqCtx';

/** 支付适配器方法所需的 Context 依赖 */
type AdapterDeps = PaymentConfigService | ReqCtxService;

/** 创建支付请求参数 */
export interface CreatePaymentParams {
  orderNo: string;
  amount: number;
  subject: string;
  description?: string;
  notifyUrl: string;
  returnUrl?: string;
  expireAt: Date;
}

/** 创建支付结果 */
export interface CreatePaymentResult {
  payUrl: string;
  prepayId?: string;
  providerData?: Record<string, unknown>;
}

/** Webhook 回调原始数据 */
export type WebhookPayload = Record<string, unknown>;

/** Webhook 验证与解析结果 */
export interface ParsedWebhookResult {
  tradeNo: string;
  orderNo: string;
  paidAmount: number;
  paymentStatus: 'success' | 'closed' | 'other';
  paidAt: Date;
  rawPayload: WebhookPayload;
}

/**
 * 支付适配器接口
 *
 * 新增平台只需实现此接口并在 adapter-registry 中注册即可。
 * 方法返回 Effect<..., R>，R 为适配器所需的 Context 依赖（由调用方注入）。
 */
export interface PaymentAdapter {
  readonly provider: PaymentProvider;
  createPayment(params: CreatePaymentParams): Effect.Effect<CreatePaymentResult, Error, AdapterDeps>;
  parseWebhook(payload: WebhookPayload, headers?: Record<string, string>): Effect.Effect<ParsedWebhookResult, Error, AdapterDeps>;
  queryOrderStatus(orderNo: string): Effect.Effect<{
    tradeNo: string;
    status: 'success' | 'pending';
    paidAmount: number;
  } | null, Error, AdapterDeps>;
}
