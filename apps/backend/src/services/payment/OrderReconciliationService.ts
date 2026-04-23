import type { DbClient } from '../../Context/DbService';
import type { AppConfig } from '../../Context/AppConfig';
import { OrderStatus, PaymentProvider } from '../../../.zenstack/models';
import { PaymentAdapterRegistry } from './adapter-registry';
import { TokenGrantService, asGrantTx } from '../TokenGrantService';
import { Effect } from 'effect';
import { PaymentConfigService } from '../../Context/PaymentConfig';
import { MS_PER_MINUTE, MS_PER_DAY } from '../../util/constants';

/** 支付配置类型（从 AppConfig 提取） */
type PaymentConfig = NonNullable<AppConfig['payment']>;

/** 每次对账最多处理的订单数 */
const RECONCILE_BATCH_SIZE = 20;

/** 开发环境对账间隔（秒）— 本地无法接收 Webhook，用高频轮询模拟 */
const DEV_RECONCILE_INTERVAL_SEC = 60;

/** 生产环境对账间隔（分钟）— 仅作为 Webhook 漏接的兜底 */
const PROD_RECONCILE_INTERVAL_MIN = 5;

/**
 * 订单对账服务
 *
 * 定时轮询 PENDING 状态订单，调用各平台 queryOrderStatus 接口
 * 查询真实支付状态，补偿 Webhook 漏接的情况。
 *
 * 优化: 只有存在未处理的 PENDING 订单时才执行实际查询，
 *       开发环境自动使用更短的轮询间隔。
 */

type QueryResult = { tradeNo: string; status: 'success' | 'pending' | 'closed'; paidAmount: number } | null;

/** Effect 上下文查询函数（由 index.ts 启动时注入） */
let queryRunner: (provider: PaymentProvider, orderNo: string) => Promise<QueryResult> = () =>
  Promise.resolve(null);

export const OrderReconciliationService = {
  /**
   * 初始化 Effect 上下文查询运行器
   */
  initQueryRunner(paymentConfig: PaymentConfig) {
    queryRunner = (provider: PaymentProvider, orderNo: string): Promise<QueryResult> => {
      const program = PaymentAdapterRegistry.getAdapter(provider).queryOrderStatus(orderNo).pipe(
        Effect.provideService(PaymentConfigService, paymentConfig),
        Effect.catchAll(() => Effect.succeed(null)),
      );
      return Effect.runPromise(program) as Promise<QueryResult>;
    };
  },

  /**
   * 快速检查是否存在需要处理的订单（不执行实际对账）
   *
   * 用于定时任务判断是否值得启动一轮完整对账
   */
  hasPendingOrders: async (db: DbClient): Promise<boolean> => {
    const now = new Date();
    const count = await db.order.count({
      where: {
        status: OrderStatus.PENDING,
        expireAt: { gt: now },
      },
    });
    return count > 0;
  },

  /**
   * 执行一轮对账
   *
   * 只有存在 PENDING 且未过期订单时才做实际查询。
   * 返回统计信息，无待处理订单时返回全零。
   */
  reconcile: async (db: DbClient): Promise<{ processed: number; paid: number; cancelled: number }> => {
    const now = new Date();

    // 先快速检查是否有待处理订单
    const pendingCount = await db.order.count({
      where: {
        status: OrderStatus.PENDING,
        expireAt: { gt: now },
      },
    });

    if (pendingCount === 0) {
      return { processed: 0, paid: 0, cancelled: 0 };
    }

    // 有订单，开始批量查询
    let processed = 0;
    let paid = 0;
    let cancelled = 0;

    const pendingOrders = await db.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        expireAt: { gt: now },
      },
      orderBy: { created: 'asc' },
      take: RECONCILE_BATCH_SIZE,
      select: {
        id: true,
        orderNo: true,
        provider: true,
        userId: true,
        packageId: true,
      },
    });

    for (const order of pendingOrders) {
      try {
        const result = await queryRunner(order.provider, order.orderNo);

        if (!result) continue;

        processed++;

        if (result.status === 'success') {
          await db.$transaction(async (tx) => {
            const pkg = await tx.tokenPackage.findUnique({ where: { id: order.packageId } });
            if (!pkg) return;

            await tx.order.update({
              where: { id: order.id },
              data: {
                status: OrderStatus.PAID,
                tradeNo: result.tradeNo,
                paidAmount: result.paidAmount,
                paidAt: new Date(),
                providerData: { source: 'reconciliation' },
              },
            });

            if (pkg.durationMonths > 0) {
              const endDate = new Date(now.getTime() + pkg.durationMonths * 30 * MS_PER_DAY);
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
              await TokenGrantService.grantFirstTime(asGrantTx(tx), {
                id: subscription.id,
                userId: order.userId,
                package: { type: pkg.type, amount: pkg.amount, name: pkg.name },
              });
            } else {
              const expiresAt = new Date(Date.now() + 365 * MS_PER_DAY);
              await tx.token.create({
                data: {
                  userId: order.userId,
                  type: pkg.type,
                  amount: pkg.amount,
                  used: 0,
                  expiresAt,
                  source: 'payment',
                  sourceId: String(order.id),
                  description: `购买套餐: ${pkg.name}(对账补偿)`,
                  restrictedType: typeof pkg.restrictedType === 'string' ? pkg.restrictedType : '[]',
                  active: true,
                },
              });
            }
          });
          paid++;
          console.log(
            `[OrderReconciliation] 对账补偿成功: orderNo=${order.orderNo}, provider=${order.provider}`,
          );
        } else if (result.status === 'closed') {
          await db.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.CANCELLED },
          });
          cancelled++;
        }
      } catch (error) {
        console.error(`[OrderReconciliation] 处理订单 ${order.orderNo} 失败:`, error);
      }
    }

    return { processed, paid, cancelled };
  },

  /**
   * 获取当前环境适用的对账间隔（毫秒）
   *
   * 开发环境返回较短间隔（本地无法接收 Webhook，靠轮询模拟）
   * 生产环境返回较长间隔（Webhook 为主，对账仅作兜底）
   */
  getReconcileIntervalMs(): number {
    const isDev = process.env.NODE_ENV !== 'production';
    return isDev
      ? DEV_RECONCILE_INTERVAL_SEC * 1000
      : PROD_RECONCILE_INTERVAL_MIN * MS_PER_MINUTE;
  },
};
