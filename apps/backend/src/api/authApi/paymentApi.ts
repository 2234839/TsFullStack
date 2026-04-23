import { Effect } from 'effect';
import { AuthContext } from '../../Context/Auth';
import { requireAdmin } from '../../Context/Auth';
import { DbClientEffect } from '../../Context/DbService';
import { ReqCtxService } from '../../Context/ReqCtx';
import { PaymentConfigService } from '../../Context/PaymentConfig';
import { AppConfigService } from '../../Context/AppConfig';
import { PaymentService } from '../../services/payment/PaymentService';
import { PaymentAdapterRegistry } from '../../services/payment/adapter-registry';
import { PaymentProvider, OrderStatus } from '../../../.zenstack/models';
import { fail, neverReturn } from '../../util/error';
import { dbTry } from '../../util/dbEffect';
import { DEFAULT_PAGE_SIZE } from '../../util/constants';
import fs from 'fs/promises';
import path from 'path';

/**
 * 创建支付订单
 */
export const createOrder = (request: { packageId: number; provider: PaymentProvider }) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    const reqCtx = yield* ReqCtxService;

    if (request.packageId <= 0) {
      yield* fail('套餐ID无效');
      return neverReturn();
    }

    const result = yield* PaymentService.createOrder({
      userId: auth.user.id,
      packageId: request.packageId,
      provider: request.provider,
    });

    reqCtx.log('[PaymentApi] 创建支付订单:', result.orderNo);
    return result;
  });

/**
 * 查询单个订单详情
 */
export const queryOrder = (orderId: number) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    return yield* PaymentService.getOrder(orderId, auth.user.id);
  });

/**
 * 查询当前用户的订单列表
 */
export const listMyOrders = (options?: { status?: OrderStatus; skip?: number; take?: number }) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    return yield* PaymentService.listOrders({ userId: auth.user.id, ...options });
  });

/**
 * 取消订单
 */
export const cancelOrder = (orderId: number) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    yield* PaymentService.cancelOrder(orderId, auth.user.id);
  });

/**
 * 获取可用支付渠道列表
 */
export const getAvailableProviders = () =>
  Effect.gen(function* () {
    const config = yield* PaymentConfigService;
    const providers = [];

    if (config.mbd?.enabled) {
      providers.push({ provider: PaymentProvider.MBD as string, name: '面包多', enabled: true });
    }
    if (config.afdian?.enabled) {
      providers.push({ provider: PaymentProvider.AFDIAN as string, name: '爱发电', enabled: true });
    }

    if (!config.mbd?.enabled) {
      providers.push({ provider: PaymentProvider.MBD as string, name: '面包多', enabled: false });
    }
    if (!config.afdian?.enabled) {
      providers.push({ provider: PaymentProvider.AFDIAN as string, name: '爱发电', enabled: false });
    }

    return providers;
  });

/**
 * 管理：查询所有订单
 */
export const adminListOrders = (options?: { userId?: string; status?: OrderStatus; skip?: number; take?: number }) =>
  Effect.gen(function* () {
    yield* requireAdmin();
    const db = yield* DbClientEffect;

    return yield* dbTry('[PaymentApi]', '查询全部订单', () =>
      db.order.findMany({
        where: {
          ...(options?.userId && { userId: options.userId }),
          ...(options?.status && { status: options.status }),
        },
        orderBy: { created: 'desc' },
        skip: options?.skip ?? 0,
        take: options?.take ?? DEFAULT_PAGE_SIZE,
        include: {
          package: { select: { id: true, name: true, type: true, amount: true } },
          user: { select: { id: true, email: true, nickname: true } },
        },
      }),
    );
  });

/**
 * 管理：获取当前支付配置（只读）
 */
export const getPaymentConfig = () =>
  Effect.gen(function* () {
    yield* requireAdmin();
    const config = yield* PaymentConfigService;
    return config;
  });

/**
 * 管理：保存支付配置（写入 config.json）
 */
export const savePaymentConfig = (config: Record<string, unknown>) =>
  Effect.gen(function* () {
    yield* requireAdmin();

    const configPath = path.join(process.cwd(), 'config.json');
    const raw = yield* Effect.tryPromise({
      try: () => fs.readFile(configPath, 'utf-8'),
      catch: () => Effect.succeed('{}'),
    });

    const current = JSON.parse(raw);
    current.payment = config;

    yield* Effect.tryPromise({
      try: () => fs.writeFile(configPath, JSON.stringify(current, null, 2), 'utf-8'),
      catch: (e) => Error(`写入配置文件失败: ${String(e)}`),
    });

    return { success: true };
  });

/**
 * 管理：测试爱发电 Webhook 连通性
 *
 * 调用爱发电"发送测试"接口，验证 Webhook URL 是否可达。
 * 实际上是通过 API 主动 ping 自己的 webhook 路径来模拟。
 */
export const testAfdianWebhook = () =>
  Effect.gen(function* () {
    yield* requireAdmin();
    const config = yield* PaymentConfigService;
    const afdianConfig = config.afdian;

    if (!afdianConfig?.apiKey || !afdianConfig.userId) {
      yield* fail('爱发电未配置 userId 或 apiKey');
      return neverReturn();
    }

    // 构造一个模拟的 Webhook 测试数据，直接调用本地 webhook 处理逻辑
    const testPayload = {
      ec: 200,
      em: 'ok',
      data: {
        type: 'order',
        order: {
          out_trade_no: `TEST_${Date.now()}`,
          user_id: afdianConfig.userId,
          plan_id: '',
          month: 0,
          total_amount: '0.01',
          show_amount: '0.01',
          status: 2,
          remark: 'webhook_test',
          redeem_id: '',
          product_type: 0,
          discount: '0.00',
          sku_detail: [],
          address_person: '',
          address_phone: '',
          address_address: '',
        },
      },
    };

    // 直接调用 handleWebhook 来测试完整链路（不会匹配到真实订单，仅验证解析是否正常）
    const result = yield* PaymentService.handleWebhook(
      PaymentProvider.AFDIAN,
      testPayload as Record<string, unknown>,
    );

    return { testPayload: true, result };
  });

/**
 * 支付 API 导出
 */
export const paymentApi = {
  createOrder,
  queryOrder,
  listMyOrders,
  cancelOrder,
  getAvailableProviders,
  adminListOrders,
  getPaymentConfig,
  savePaymentConfig,
  testAfdianWebhook,
};
