import { Effect } from 'effect';
import type { PaymentProvider } from '../../../../.zenstack/models';

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
 * 方法返回值不做严格约束（使用 any），因为各 adapter 的 Effect 依赖不同 Context。
 */
export interface PaymentAdapter {
  readonly provider: PaymentProvider;
  createPayment(params: CreatePaymentParams): any;
  parseWebhook(payload: WebhookPayload, headers?: Record<string, string>): any;
  queryOrderStatus(orderNo: string): any;
}
