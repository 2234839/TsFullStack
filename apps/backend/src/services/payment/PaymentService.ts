import { Effect } from 'effect';
import { DbClientEffect } from '../../Context/DbService';
import { ReqCtxService } from '../../Context/ReqCtx';
import { PaymentConfigService } from '../../Context/PaymentConfig';
import { dbTry, dbTryRequire, dbPaginatedFindMany } from '../../util/dbEffect';
import { fail } from '../../util/error';
import { MSG, MS_PER_MINUTE, DEFAULT_PAGE_SIZE, deepCloneToJson } from '../../util/constants';
import { OrderStatus, PaymentProvider } from '../../../.zenstack/models';
import { PaymentAdapterRegistry } from './adapter-registry';
import { grantTokensForPackage } from './grantTokensForPackage';
import { asGrantTx } from '../TokenGrantService';

/** 生成订单号: TS + 时间戳(36进制) + 随机6位 */
function generateOrderNo(): string {
  const now = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TS${now}${rand}`;
}

const DEFAULT_ORDER_EXPIRE_MINUTES = 30;

/** 日志前缀 */
const LOG_PREFIX = '[PaymentService]';

/**
 * 支付服务
 *
 * 负责：订单 CRUD、状态流转、代币发放协调。
 * 不依赖 AuthContext（userId 通过参数传入），权限由 API 层控制。
 */
export const PaymentService = {
  /**
   * 创建支付订单
   *
   * 流程: 验证套餐 → 创建 Order 记录 → 调用适配器获取支付链接 → 返回 payUrl
   */
  createOrder: (params: { userId: string; packageId: number; provider: PaymentProvider }) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;
      const config = yield* PaymentConfigService;
      const reqCtx = yield* ReqCtxService;

      // 1. 查询套餐
      const pkg = yield* dbTryRequire(LOG_PREFIX, '查询套餐', () =>
        db.tokenPackage.findUnique({ where: { id: params.packageId } }),
        MSG.PACKAGE_NOT_FOUND,
      );
      if (!pkg.active) { return yield* fail(MSG.PACKAGE_DISABLED); }
      if (pkg.price === null || pkg.price <= 0) {
        return yield* fail(MSG.PACKAGE_NO_ONLINE_PURCHASE);
      }
      const price = pkg.price;

      // 2. 生成订单号和过期时间
      const orderNo = generateOrderNo();
      const expireMinutes = config.orderExpireMinutes ?? DEFAULT_ORDER_EXPIRE_MINUTES;
      const expireAt = new Date(Date.now() + expireMinutes * MS_PER_MINUTE);

      // 3. 创建订单记录
      const order = yield* dbTry(LOG_PREFIX, '创建订单', () =>
        db.order.create({
          data: {
            orderNo,
            userId: params.userId,
            packageId: params.packageId,
            provider: params.provider,
            amount: price,
            status: OrderStatus.PENDING,
            expireAt,
          },
        }),
      );

      // 4. 获取适配器并创建支付
      const adapter = yield* PaymentAdapterRegistry.getAdapter(params.provider);
      const paymentResultRaw = yield* adapter.createPayment({
        orderNo,
        amount: price,
        subject: `TsFullStack - ${pkg.name}`,
        description: pkg.description ?? undefined,
        notifyUrl: '',
        returnUrl: '',
        expireAt,
      });

      // 5. 更新订单的 providerData（如果有）
      if (paymentResultRaw?.providerData) {
        yield* dbTry(LOG_PREFIX, '更新订单支付数据', () =>
          db.order.update({
            where: { id: order.id },
            data: { providerData: deepCloneToJson(paymentResultRaw.providerData) },
          }),
        );
      }

      reqCtx.log(LOG_PREFIX, '创建订单:', orderNo, 'provider:', params.provider, 'amount:', price);

      return {
        orderId: order.id,
        orderNo: order.orderNo,
        payUrl: paymentResultRaw.payUrl,
        providerData: paymentResultRaw.providerData ?? undefined,
        expireAt: order.expireAt,
      };
    }),

  /**
   * 查询单个订单详情
   */
  getOrder: (orderId: number, userId: string) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;
      return yield* dbTry(LOG_PREFIX, '查询订单', () =>
        db.order.findFirst({
          where: { id: orderId, userId },
          include: { package: true },
        }),
      );
    }),

  /**
   * 查询用户的订单列表（分页）
   */
  listOrders: (params: { userId: string; status?: OrderStatus; skip?: number; take?: number }) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;
      const where = { userId: params.userId, ...(params.status && { status: params.status }) };
      const { items, total } = yield* dbPaginatedFindMany(LOG_PREFIX,
        () => db.order.findMany({
          where,
          orderBy: { created: 'desc' },
          skip: params.skip ?? 0,
          take: params.take ?? DEFAULT_PAGE_SIZE,
          include: { package: true },
        }),
        () => db.order.count({ where }),
      );
      return { orders: items, total };
    }),

  /**
   * 处理 Webhook 回调（核心：验证 → 更新状态 → 发放代币）
   *
   * 此方法不需要 AuthContext（由第三方平台调用），
   * 使用 DbClientEffect 直接操作数据库。
   */
  handleWebhook: (provider: PaymentProvider, payload: Record<string, unknown>, headers?: Record<string, string>) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;
      const reqCtx = yield* ReqCtxService;

      // 1. 获取适配器并验证+解析回调
      const adapter = yield* PaymentAdapterRegistry.getAdapter(provider);
      const parsed = yield* adapter.parseWebhook(payload, headers);

      reqCtx.log(
        LOG_PREFIX, 'Webhook 回调:',
        'provider=', provider,
        'orderNo=', parsed.orderNo,
        'tradeNo=', parsed.tradeNo,
        'status=', parsed.paymentStatus,
      );

      // 2. 查找订单
      const order = yield* dbTry(LOG_PREFIX, '查找订单', () =>
        db.order.findFirst({
          where: { orderNo: parsed.orderNo },
          include: { package: true, user: true },
        }),
      );

      if (!order) {
        reqCtx.log(LOG_PREFIX, '订单不存在:', parsed.orderNo);
        return { success: false, reason: 'ORDER_NOT_FOUND' as const };
      }

      // 3. 幂等处理：已支付的订单不再处理
      if (order.status === OrderStatus.PAID) {
        reqCtx.log(LOG_PREFIX, '订单已支付，跳过幂等处理:', order.orderNo);
        return { success: true, reason: 'ALREADY_PAID' as const, skipped: true };
      }

      // 4. 处理支付结果
      if (parsed.paymentStatus === 'success') {
        const pkg = order.package;
        if (!pkg) {
          reqCtx.log(LOG_PREFIX, '订单缺少关联套餐:', order.orderNo);
          return { success: false as const, reason: 'PACKAGE_NOT_FOUND' as const };
        }

        // 使用事务保证：更新订单 + 发放代币 的原子性
        yield* dbTry(LOG_PREFIX, '支付成功事务处理', () =>
          db.$transaction(async (tx) => {
            // 4a. 更新订单状态为已支付
            await tx.order.update({
              where: { id: order.id },
              data: {
                status: OrderStatus.PAID,
                tradeNo: parsed.tradeNo,
                paidAmount: parsed.paidAmount,
                paidAt: parsed.paidAt,
                providerData: deepCloneToJson(parsed.rawPayload),
              },
            });

            // 4b. 根据套餐类型发放代币
            await grantTokensForPackage(asGrantTx(tx), order.userId, pkg, order.id, `购买套餐: ${pkg.name}`);
          }),
        );

        reqCtx.log(
          LOG_PREFIX, '支付成功, 代币已发放:',
          'orderNo=', order.orderNo,
          'userId=', order.userId,
          'package=', pkg.name,
          'amount=', pkg.amount,
        );

        return { success: true as const, orderId: order.id };
      }

      if (parsed.paymentStatus === 'closed') {
        yield* dbTry(LOG_PREFIX, '更新订单为关闭', () =>
          db.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.CANCELLED, providerData: deepCloneToJson(parsed.rawPayload) },
          }),
        );
        return { success: true as const, reason: 'PAYMENT_CLOSED' as const };
      }

      // 其他状态不更新，等待后续回调
      reqCtx.log(LOG_PREFIX, '未识别的支付状态:', parsed.paymentStatus);
      return { success: false as const, reason: 'UNKNOWN_STATUS' as const };
    }),

  /**
   * 取消订单（仅限 PENDING 状态）
   */
  cancelOrder: (orderId: number, userId: string) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;

      const order = yield* dbTryRequire(LOG_PREFIX, '查询订单', () =>
        db.order.findFirst({ where: { id: orderId, userId } }),
        MSG.ORDER_NOT_FOUND,
      );
      if (order.status !== OrderStatus.PENDING) {
        return yield* fail(MSG.CANCEL_PENDING_ONLY);
      }

      yield* dbTry(LOG_PREFIX, '取消订单', () =>
        db.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } }),
      );
    }),
};
