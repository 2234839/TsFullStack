import type { DbClient } from '../../Context/DbService';
import { OrderStatus, PaymentProvider } from '../../../.zenstack/models';
import { PaymentAdapterRegistry } from './adapter-registry';
import { grantTokensForPackage } from './grantTokensForPackage';
import { asGrantTx } from '../TokenGrantService';
import { Effect } from 'effect';
import { PaymentConfigService } from '../../Context/PaymentConfig';
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

/**
 * 查询订单真实支付状态（Effect 版）
 *
 * R 为 AdapterDeps，由调用方 provide；查询失败兜底为 null 并记录日志
 */
export const queryOrderStatus = (
  provider: PaymentProvider,
  orderNo: string,
): Effect.Effect<QueryResult, never, PaymentConfigService> =>
  PaymentAdapterRegistry.getAdapter(provider).pipe(
    Effect.flatMap((adapter) => adapter.queryOrderStatus(orderNo)),
    Effect.tapError((error) =>
      Effect.logError(
        `${LOG_PREFIX} queryOrderStatus failed for ${provider}/${orderNo}: ${extractErrorMessage(error)}`,
      ),
    ),
    Effect.catch(() => Effect.succeed(null)),
  );

/** 订单状态查询函数（由调用方注入 PaymentConfigService 后传入） */
export type OrderQuery = (provider: PaymentProvider, orderNo: string) => Promise<QueryResult>;

export const OrderReconciliationService = {
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
   * 返回统计信息，无待处理订单时返回全零。
   */
  reconcile: async (
    db: DbClient,
    query: OrderQuery,
  ): Promise<{ processed: number; paid: number; cancelled: number }> => {
    const now = new Date();
    const where = pendingOrderWhere(now);

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
        const result = await query(order.provider, order.orderNo);

        if (!result) continue;

        processed++;

        if (result.status === 'success') {
          await db.$transaction(async (tx) => {
            /** 并行查询订单状态和套餐信息（两者无数据依赖） */
            const [fresh, pkg] = await Promise.all([
              tx.order.findUnique({ where: { id: order.id }, select: { status: true } }),
              tx.tokenPackage.findUnique({ where: { id: order.packageId } }),
            ]);
            if (!fresh || fresh.status !== OrderStatus.PENDING) return;
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
          console.log(`${LOG_PREFIX} 对账补偿成功: orderNo=${order.orderNo}, provider=${order.provider}`);
        }
        /** status 为 pending 时本轮不处理，等待支付平台状态推进 */
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
    return isDev ? DEV_RECONCILE_INTERVAL_SEC * 1000 : PROD_RECONCILE_INTERVAL_MIN * MS_PER_MINUTE;
  },
};
