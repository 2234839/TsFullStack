import type { DbClient } from '../Context/DbService';
import { TokenType } from '../../.zenstack/models';
import { MS_PER_DAY, DAYS_PER_MONTH_APPROX, DAYS_PER_YEAR, QUEUE_NAME_GRANT_TOKENS, MSG } from '../util/constants';

/**
 * 代币发放队列任务的服务方法
 * 从 index.ts 中提取，使启动文件保持简洁
 *
 * 接受 dbClient 参数而非依赖 Effect Context，
 * 因为队列处理器运行在 async 回调上下文中（非 Effect 管道）。
 */

/** 根据套餐类型计算发放间隔天数 */
function getGrantIntervalDays(tokenType: string): number {
  if (tokenType === TokenType.MONTHLY) return DAYS_PER_MONTH_APPROX;
  if (tokenType === TokenType.YEARLY || tokenType === TokenType.PERMANENT) return DAYS_PER_YEAR;
  return DAYS_PER_MONTH_APPROX;
}

/** 代币发放队列默认优先级 */
const TOKEN_GRANT_QUEUE_PRIORITY = 5;

/** 代币发放队列最大重试次数 */
const TOKEN_GRANT_MAX_ATTEMPTS = 3;

/** 事务客户端所需的最小方法集（使用宽松类型以兼容 Prisma TransactionClient 和 DbClient） */
export interface GrantTxClient {
  token: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
  userTokenSubscription: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: number; userId: string }>;
    update: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>;
  };
  queue: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
}

/** 订阅关联的套餐信息（发放代币时使用的子集） */
export interface SubscriptionPackage {
  type: string;
  amount: number;
  name: boolean | string;
  /** 专用类型限制（JSON 字符串或 null） */
  restrictedType?: string;
}

/** 将 $transaction 回调中的 tx 窄窄为 GrantTxClient（运行时保证有这 3 个方法） */
export function asGrantTx<T>(tx: T): T & GrantTxClient {
  return tx as T & GrantTxClient;
}

/** 执行一次订阅代币发放的核心逻辑（创建代币、更新订阅、调度下次任务），供 subscribePackage 和队列处理器共用 */
async function grantOnce(tx: GrantTxClient, subscription: {
  id: number;
  userId: string;
  package: SubscriptionPackage;
}, descriptionPrefix: string) {
  const grantIntervalDays = getGrantIntervalDays(subscription.package.type);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + grantIntervalDays * MS_PER_DAY);
  const pkgName = typeof subscription.package.name === 'boolean' ? '' : subscription.package.name;

  await tx.token.create({
    data: {
      userId: subscription.userId,
      type: subscription.package.type,
      amount: subscription.package.amount,
      used: 0,
      expiresAt,
      source: 'subscription',
      sourceId: String(subscription.id),
      description: `${descriptionPrefix}${pkgName}`,
      restrictedType: subscription.package.restrictedType ?? '[]',
    },
  });

  const nextGrantDate = new Date(now.getTime() + grantIntervalDays * MS_PER_DAY);

  await tx.userTokenSubscription.update({
    where: { id: subscription.id },
    data: { nextGrantDate, grantsCount: { increment: 1 } },
  });

  await tx.queue.create({
    data: {
      name: QUEUE_NAME_GRANT_TOKENS,
      payload: { subscriptionId: subscription.id, userId: subscription.userId },
      status: 'PENDING',
      priority: TOKEN_GRANT_QUEUE_PRIORITY,
      runAt: nextGrantDate,
      maxAttempts: TOKEN_GRANT_MAX_ATTEMPTS,
    },
  });

  return { nextGrantDate, expiresAt };
}

export const TokenGrantService = {
  /**
   * 处理订阅代币发放（队列任务处理器）
   */
  processSubscriptionGrant: (
    payload: { subscriptionId: number; userId: string },
    db: DbClient,
  ) =>
    db.$transaction(async (tx) => {
      const subscription = await tx.userTokenSubscription.findFirst({
        where: { id: payload.subscriptionId, userId: payload.userId, active: true },
        include: { package: true },
      });

      if (!subscription) {
        return { success: false, skipped: true, reason: '订阅不存在或已取消' };
      }

      if (subscription.endDate && new Date() > subscription.endDate) {
        await tx.userTokenSubscription.update({ where: { id: subscription.id }, data: { active: false } });
        return { success: false, skipped: true, reason: '订阅已过期' };
      }

      if (!subscription.package.active) {
        return { success: false, skipped: true, reason: MSG.PACKAGE_DISABLED };
      }

      const { nextGrantDate } = await grantOnce(asGrantTx(tx), {
        ...subscription,
        package: {
          ...subscription.package,
          restrictedType: typeof subscription.package.restrictedType === 'string'
            ? subscription.package.restrictedType
            : undefined,
        },
      }, '套餐自动发放：');

      return {
        success: true,
        userId: subscription.userId,
        packageName: subscription.package.name,
        amount: subscription.package.amount,
        nextGrantDate,
      };
    }),

  /** 首次订阅时立即发放一次代币（与 processSubscriptionGrant 共用 grantOnce 核心），调用方需自行通过 asGrantTx 窄化 tx */
  grantFirstTime: (tx: GrantTxClient, subscription: { id: number; userId: string; package: SubscriptionPackage }) =>
    grantOnce(tx, subscription, '订阅套餐：'),
};
