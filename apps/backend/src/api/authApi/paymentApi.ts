import { Effect } from 'effect';
import { AuthContext, requireAdmin } from '../../Context/Auth';
import { DbClientEffect } from '../../Context/DbService';
import { ReqCtxService } from '../../Context/ReqCtx';
import { PaymentConfigService } from '../../Context/PaymentConfig';
import { PaymentService } from '../../services/payment/PaymentService';
import { PaymentProvider, OrderStatus } from '../../../.zenstack/models';
import { fail, requireOrFail, tryOrFail } from '../../util/error';
import { adminDbTry, dbTry, dbTryRequire } from '../../util/dbEffect';
import { DEFAULT_PAGE_SIZE, MSG, deepCloneToJson } from '../../util/constants';
import { grantTokensForPackage } from '../../services/payment/grantTokensForPackage';
import { asGrantTx } from '../../services/TokenGrantService';
import fs from 'fs/promises';
import path from 'path';

/** 日志前缀 */
const LOG_PREFIX = '[PaymentApi]';

/**
 * 创建支付订单
 */
const createOrder = (request: { packageId: number; provider: PaymentProvider }) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    const reqCtx = yield* ReqCtxService;

    if (request.packageId <= 0) {
      return yield* fail(MSG.PACKAGE_ID_INVALID);
    }

    const result = yield* PaymentService.createOrder({
      userId: auth.user.id,
      packageId: request.packageId,
      provider: request.provider,
    });

    reqCtx.log(LOG_PREFIX, '创建支付订单:', result.orderNo);
    return result;
  });

/**
 * 查询单个订单详情
 */
const queryOrder = (orderId: number) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    return yield* PaymentService.getOrder(orderId, auth.user.id);
  });

/**
 * 查询当前用户的订单列表
 */
const listMyOrders = (options?: { status?: OrderStatus; skip?: number; take?: number }) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    return yield* PaymentService.listOrders({ userId: auth.user.id, ...options });
  });

/**
 * 取消订单
 */
const cancelOrder = (orderId: number) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    return yield* PaymentService.cancelOrder(orderId, auth.user.id);
  });

/**
 * 获取可用支付渠道列表
 */
const getAvailableProviders = () =>
  Effect.gen(function* () {
    const config = yield* PaymentConfigService;
    return [
      { provider: PaymentProvider.MBD, name: '面包多', enabled: Boolean(config.mbd?.enabled) },
      { provider: PaymentProvider.AFDIAN, name: '爱发电', enabled: Boolean(config.afdian?.enabled) },
      { provider: PaymentProvider.WECHAT, name: '微信好友支付', enabled: Boolean(config.wechat?.enabled) },
    ];
  });

/**
 * 管理：查询所有订单
 */
const adminListOrders = (options?: { userId?: string; status?: OrderStatus; skip?: number; take?: number }) =>
  adminDbTry(LOG_PREFIX, '查询全部订单', async (db) => {
    const where = {
      ...(options?.userId && { userId: options.userId }),
      ...(options?.status && { status: options.status }),
    };
    const [items, count] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { created: 'desc' },
        skip: options?.skip ?? 0,
        take: options?.take ?? DEFAULT_PAGE_SIZE,
        include: {
          package: { select: { id: true, name: true, type: true, amount: true } },
          user: { select: { id: true, email: true, nickname: true } },
        },
      }),
      db.order.count({ where }),
    ]);
    return { items, total: count };
  });

/**
 * 管理：获取当前支付配置（只读）
 */
const getPaymentConfig = () =>
  Effect.gen(function* () {
    yield* requireAdmin();
    return yield* PaymentConfigService;
  });

/**
 * 管理：保存支付配置（写入 config.json）
 */
const savePaymentConfig = (config: Record<string, unknown>) =>
  Effect.gen(function* () {
    yield* requireAdmin();

    const configPath = path.join(process.cwd(), 'config.json');
    const raw = yield* tryOrFail('读取配置文件', () => fs.readFile(configPath, 'utf-8'));

    const current = JSON.parse(raw);
    current.payment = config;

    yield* tryOrFail('写入配置文件', () => fs.writeFile(configPath, JSON.stringify(current, null, 2), 'utf-8'));

    return { success: true };
  });

/**
 * 管理：测试爱发电 Webhook 连通性
 *
 * 调用爱发电"发送测试"接口，验证 Webhook URL 是否可达。
 * 实际上是通过 API 主动 ping 自己的 webhook 路径来模拟。
 */
const testAfdianWebhook = () =>
  Effect.gen(function* () {
    yield* requireAdmin();
    const config = yield* PaymentConfigService;
    const afdianConfig = config.afdian;

    if (!afdianConfig?.apiKey || !afdianConfig.userId) {
      return yield* fail(MSG.AFDIAN_MISSING_CREDENTIALS);
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
 * 管理：手动确认微信订单已到账
 *
 * 将微信好友支付的 PENDING 订单标记为 PAID，并触发代币发放。
 * 不受订单过期时间限制，即使已过期也可确认。
 */
const confirmOrderPayment = (orderId: number) =>
  Effect.gen(function* () {
    yield* requireAdmin();
    const db = yield* DbClientEffect;
    const reqCtx = yield* ReqCtxService;

    const order = yield* dbTryRequire(LOG_PREFIX, '查询待确认订单', () =>
      db.order.findUnique({
        where: { id: orderId },
        include: { package: true, user: true },
      }),
      MSG.ORDER_NOT_FOUND,
    );
    if (order.provider !== PaymentProvider.WECHAT) {
      return yield* fail(MSG.WECHAT_ORDER_ONLY);
    }
    if (order.status === OrderStatus.PAID) {
      return yield* fail(MSG.ORDER_ALREADY_CONFIRMED);
    }
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.FAILED) {
      return yield* fail(MSG.ORDER_STATUS_INVALID_FOR_CONFIRM);
    }

    const pkg = yield* requireOrFail(order.package, MSG.ORDER_MISSING_PACKAGE);
    const now = new Date();

    yield* dbTry(LOG_PREFIX, '确认微信订单到账', () =>
      db.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.PAID,
            tradeNo: `WX_MANUAL_${Date.now()}`,
            paidAmount: order.amount,
            paidAt: now,
            providerData: deepCloneToJson({
              source: 'admin_manual_confirm',
              confirmedBy: 'admin',
              confirmedAt: now.toISOString(),
            }),
          },
        });

        await grantTokensForPackage(asGrantTx(tx), order.userId, pkg, orderId, `购买套餐: ${pkg.name}(微信人工确认)`);
      }),
    );

    reqCtx.log(
      `${LOG_PREFIX} 管理员确认微信订单到账:`,
      'orderNo=', order.orderNo,
      'userId=', order.userId,
      'package=', pkg.name,
    );

    return { success: true, orderId };
  });

/**
 * 公开：获取联系方式信息（无需登录）
 *
 * 返回微信号等联系信息供前端公共页面展示（支付页兜底指引等）。
 */
const getPublicContactInfo = () =>
  Effect.gen(function* () {
    const config = yield* PaymentConfigService;
    return {
      wechatAccountId: config.wechat?.accountId ?? null,
      wechatAccountName: config.wechat?.accountName ?? null,
    };
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
  confirmOrderPayment,
  getPublicContactInfo,
};
