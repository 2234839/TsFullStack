import type { DbClient } from '../../Context/DbService';
import { OrderStatus, PaymentProvider } from '../../../.zenstack/models';
import { PaymentAdapterRegistry } from './adapter-registry';
import { grantTokensForPackage } from './grantTokensForPackage';
import { asGrantTx } from '../TokenGrantService';
import { Effect } from 'effect';
import { PaymentConfigService, type PaymentConfig } from '../../Context/PaymentConfig';
import { MS_PER_MINUTE } from '../../util/constants';
import { extractErrorMessage } from '../../util/error';

/** 每次对账最多处理的订单数 */
const RECONCILE_BATCH_SIZE = 20;

/** 开发环境对账间隔（秒）— 本地无法接收 Webhook，用高频轮询模拟 */
const DEV_RECONCILE_INTERVAL_SEC = 60;

/** 日志前缀 */
const LOG_PREFIX = '[OrderReconciliation]';

/** 生产环境对账间隔（分钟）— 仅作为 Webhook 漏接的兜底 */
const PROD_RECONCILE_INTERVAL_MIN = 5;

/** 构建 PENDING 未过期订单的 where 条件 */
function pendingOrderWhere(now: Date) {
  return { status: OrderStatus.PENDING, expireAt: { gt: now } } as const;
}

/**
 * 订单对账服务
 *
 * 定时轮询 PENDING 状态订单，调用各平台 queryOrderStatus 接口
 * 查询真实支付状态，补偿 Webhook 漏接的情况。
 *
 * 优化: 只有存在未处理的 PENDING 订单时才执行实际查询，
 *       开发环境自动使用更短的轮询间隔。
 */

type QueryResult = { tradeNo: string; status: 'success' | 'pending'; paidAmount: number } | null;

/** Effect 上下文查询函数（由 index.ts 启动时注入） */
let queryRunner: (provider: PaymentProvider, orderNo: string) => Promise<QueryResult> = () =>
  Promise.resolve(null);

export const OrderReconciliationService = {
  /**
   * 初始化 Effect 上下文查询运行器
   */
  initQueryRunner(paymentConfig: PaymentConfig) {
    queryRunner = (provider: PaymentProvider, orderNo: string): Promise<QueryResult> => {
      const program = Effect.gen(function* () {
        const adapter = yield* PaymentAdapterRegistry.getAdapter(provider);
        return yield* adapter.queryOrderStatus(orderNo);
      }).pipe(
        Effect.provideService(PaymentConfigService, paymentConfig),
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* Effect.logError(`${LOG_PREFIX} queryOrderStatus failed for ${provider}/${orderNo}: ${extractErrorMessage(error)}`);
            return null;
          })
        ),
      );
      /** catchAll 保证错误通道为 never；provideService 满足所有依赖后 R=never */
      return Effect.runPromise(program as Effect.Effect<QueryResult, never, never>);
    };
  },

  /**
   * 快速检查是否存在需要处理的订单（不执行实际对账）
   *
   * 用于定时任务判断是否值得启动一轮完整对账
   */
  hasPendingOrders: async (db: DbClient): Promise<boolean> => {
    const count = await db.order.count({ where: pendingOrderWhere(new Date()) });
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
    const where = pendingOrderWhere(now);

    // 先快速检查是否有待处理订单
    const pendingCount = await db.order.count({ where });

    if (pendingCount === 0) {
      return { processed: 0, paid: 0, cancelled: 0 };
    }

    // 有订单，开始批量查询
    let processed = 0;
    let paid = 0;
    let cancelled = 0;

    const pendingOrders = await db.order.findMany({
      where,
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

            await grantTokensForPackage(asGrantTx(tx), order.userId, pkg, order.id, `购买套餐: ${pkg.name}(对账补偿)`);
          });
          paid++;
          console.log(
            `${LOG_PREFIX} 对账补偿成功: orderNo=${order.orderNo}, provider=${order.provider}`,
          );
        }
      } catch (error: unknown) {
        console.error(`${LOG_PREFIX} 处理订单 ${order.orderNo} 失败:`, error);
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
