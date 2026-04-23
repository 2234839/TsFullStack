import { Effect } from 'effect';
import { DbClientEffect } from '../../Context/DbService';
import { ReqCtxService } from '../../Context/ReqCtx';
import { PaymentConfigService } from '../../Context/PaymentConfig';
import { dbTry, dbTryOrDefault } from '../../util/dbEffect';
import { fail, neverReturn } from '../../util/error';
import { MSG } from '../../util/constants';
import { OrderStatus, PaymentProvider } from '../../../.zenstack/models';
import { PaymentAdapterRegistry } from './adapter-registry';
import type { CreatePaymentResult, ParsedWebhookResult } from './adapters/types';
import { TokenGrantService, asGrantTx } from '../TokenGrantService';
import { MS_PER_MINUTE, MS_PER_DAY } from '../../util/constants';

/** 生成订单号: TS + 时间戳(36进制) + 随机6位 */
function generateOrderNo(): string {
  const now = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TS${now}${rand}`;
}

const DEFAULT_ORDER_EXPIRE_MINUTES = 30;

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
      const pkg = yield* dbTry('[PaymentService]', '查询套餐', () =>
        db.tokenPackage.findUnique({ where: { id: params.packageId } }),
      );
      if (!pkg) { yield* fail(MSG.PACKAGE_NOT_FOUND); return neverReturn(); }
      if (!pkg.active) { yield* fail('该套餐已停用'); return neverReturn(); }
      if (pkg.price === null || pkg.price <= 0) {
        yield* fail('该套餐不支持在线购买（价格未设置）');
        return neverReturn();
      }

      // 2. 生成订单号和过期时间
      const orderNo = generateOrderNo();
      const expireMinutes = config.orderExpireMinutes ?? DEFAULT_ORDER_EXPIRE_MINUTES;
      const expireAt = new Date(Date.now() + expireMinutes * MS_PER_MINUTE);

      // 3. 创建订单记录
      const order = yield* dbTry('[PaymentService]', '创建订单', () =>
        db.order.create({
          data: {
            orderNo,
            userId: params.userId,
            packageId: params.packageId,
            provider: params.provider,
            amount: pkg.price!,
            status: OrderStatus.PENDING,
            expireAt,
          },
        }),
      );

      // 4. 获取适配器并创建支付
      const adapter = PaymentAdapterRegistry.getAdapter(params.provider);
      const paymentResultRaw = yield* adapter.createPayment({
        orderNo,
        amount: pkg.price!,
        subject: `TsFullStack - ${pkg.name}`,
        description: pkg.description ?? undefined,
        notifyUrl: '',
        returnUrl: '',
        expireAt,
      });
      const paymentResult = paymentResultRaw as CreatePaymentResult;

      // 5. 更新订单的 providerData（如果有）
      if (paymentResult?.providerData) {
        yield* dbTry('[PaymentService]', '更新订单支付数据', () =>
          db.order.update({
            where: { id: order.id },
            data: { providerData: JSON.parse(JSON.stringify(paymentResult.providerData)) },
          }),
        );
      }

      reqCtx.log('[PaymentService] 创建订单:', orderNo, 'provider:', params.provider, 'amount:', pkg.price);

      return { orderId: order.id, orderNo: order.orderNo, payUrl: paymentResult.payUrl, expireAt: order.expireAt };
    }),

  /**
   * 查询单个订单详情
   */
  getOrder: (orderId: number, userId: string) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;
      return yield* dbTry('[PaymentService]', '查询订单', () =>
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
      const [orders, total] = yield* Effect.all([
        dbTry('[PaymentService]', '查询订单列表', () =>
          db.order.findMany({
            where: { userId: params.userId, ...(params.status && { status: params.status }) },
            orderBy: { created: 'desc' },
            skip: params.skip ?? 0,
            take: params.take ?? 20,
            include: { package: true },
          }),
        ),
        dbTryOrDefault('[PaymentService]', '查询订单总数', () =>
          db.order.count({
            where: { userId: params.userId, ...(params.status && { status: params.status }) },
          }), 0),
      ]);
      return { orders, total };
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
      const adapter = PaymentAdapterRegistry.getAdapter(provider);
      const parsedRaw = yield* adapter.parseWebhook(payload, headers);
      const parsed = parsedRaw as ParsedWebhookResult;

      reqCtx.log(
        '[PaymentService] Webhook 回调:',
        'provider=', provider,
        'orderNo=', parsed.orderNo,
        'tradeNo=', parsed.tradeNo,
        'status=', parsed.paymentStatus,
      );

      // 2. 查找订单
      const order = yield* dbTry('[PaymentService]', '查找订单', () =>
        db.order.findFirst({
          where: { orderNo: parsed.orderNo },
          include: { package: true, user: true },
        }),
      );

      if (!order) {
        reqCtx.log('[PaymentService] 订单不存在:', parsed.orderNo);
        return { success: false, reason: 'ORDER_NOT_FOUND' as const };
      }

      // 3. 幂等处理：已支付的订单不再处理
      if (order.status === OrderStatus.PAID) {
        reqCtx.log('[PaymentService] 订单已支付，跳过幂等处理:', order.orderNo);
        return { success: true, reason: 'ALREADY_PAID' as const, skipped: true };
      }

      // 4. 处理支付结果
      if (parsed.paymentStatus === 'success') {
        const pkg = order.package!;

        // 使用事务保证：更新订单 + 发放代币 的原子性
        yield* dbTry('[PaymentService]', '支付成功事务处理', () =>
          db.$transaction(async (tx) => {
            // 4a. 更新订单状态为已支付
            await tx.order.update({
              where: { id: order.id },
              data: {
                status: OrderStatus.PAID,
                tradeNo: parsed.tradeNo,
                paidAmount: parsed.paidAmount,
                paidAt: parsed.paidAt,
                providerData: JSON.parse(JSON.stringify(parsed.rawPayload)),
              },
            });

            // 4b. 根据套餐类型发放代币
            if (pkg.durationMonths > 0) {
              // 订阅型套餐：创建订阅记录 + 首次发放
              const now = new Date();
              const endDate = pkg.durationMonths > 0
                ? new Date(now.getTime() + pkg.durationMonths * 30 * MS_PER_DAY)
                : null;

              const subscription = await tx.userTokenSubscription.create({
                data: {
                  userId: order.userId,
                  packageId: pkg.id,
                  startDate: now,
                  endDate,
                  nextGrantDate: now,
                  active: true,
                  grantsCount: 0,
                },
              });

              // 复用 TokenGrantService 的首次发放逻辑
              await TokenGrantService.grantFirstTime(asGrantTx(tx), {
                id: subscription.id,
                userId: order.userId,
                package: { type: pkg.type, amount: pkg.amount, name: pkg.name },
              });
            } else {
              // 一次性购买：直接发放代币
              const expiresAt = new Date(Date.now() + 365 * MS_PER_DAY); // 默认1年有效期
              await tx.token.create({
                data: {
                  userId: order.userId,
                  type: pkg.type,
                  amount: pkg.amount,
                  used: 0,
                  expiresAt,
                  source: 'payment',
                  sourceId: String(order.id),
                  description: `购买套餐: ${pkg.name}`,
                  restrictedType: typeof pkg.restrictedType === 'string' ? pkg.restrictedType : '[]',
                  active: true,
                },
              });
            }
          }),
        );

        reqCtx.log(
          '[PaymentService] 支付成功, 代币已发放:',
          'orderNo=', order.orderNo,
          'userId=', order.userId,
          'package=', pkg.name,
          'amount=', pkg.amount,
        );

        return { success: true as const, orderId: order.id };
      }

      if (parsed.paymentStatus === 'closed') {
        yield* dbTry('[PaymentService]', '更新订单为关闭', () =>
          db.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.CANCELLED, providerData: JSON.parse(JSON.stringify(parsed.rawPayload)) },
          }),
        );
        return { success: true as const, reason: 'PAYMENT_CLOSED' as const };
      }

      // 其他状态不更新，等待后续回调
      reqCtx.log('[PaymentService] 未识别的支付状态:', parsed.paymentStatus);
      return { success: false as const, reason: 'UNKNOWN_STATUS' as const };
    }),

  /**
   * 取消订单（仅限 PENDING 状态）
   */
  cancelOrder: (orderId: number, userId: string) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;

      const order = yield* dbTry('[PaymentService]', '查询订单', () =>
        db.order.findFirst({ where: { id: orderId, userId } }),
      );
      if (!order) { yield* fail(MSG.ORDER_NOT_FOUND); return neverReturn(); }
      if (order.status !== OrderStatus.PENDING) {
        yield* fail('只能取消待支付的订单');
        return neverReturn();
      }

      yield* dbTry('[PaymentService]', '取消订单', () =>
        db.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } }),
      );
    }),
};
