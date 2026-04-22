import type { DbClient } from '../Context/DbService';
import { MS_PER_DAY } from '../util/constants';
import { MsgError } from '../util/error';

/**
 * 代币发放队列任务的服务方法
 * 从 index.ts 中提取，使启动文件保持简洁
 *
 * 接受 dbClient 参数而非依赖 Effect Context，
 * 因为队列处理器运行在 async 回调上下文中（非 Effect 管道）。
 */

/** 根据套餐类型计算发放间隔天数 */
export function getGrantIntervalDays(tokenType: string): number {
  if (tokenType === 'MONTHLY') return 30;
  if (tokenType === 'YEARLY' || tokenType === 'PERMANENT') return 365;
  return 30; // 默认月度
}

/** 执行一次订阅代币发放的核心逻辑（创建代币、更新订阅、调度下次任务），供 subscribePackage 和队列处理器共用 */
async function grantOnce(tx: DbClient, subscription: {
  id: number;
  userId: string;
  package: { type: string; amount: number; name: boolean | string };
}, descriptionPrefix: string) {
  const grantIntervalDays = getGrantIntervalDays(subscription.package.type);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + grantIntervalDays * MS_PER_DAY);
  const pkgName = typeof subscription.package.name === 'boolean' ? '' : subscription.package.name;

  await tx.token.create({
    data: {
      userId: subscription.userId,
      type: subscription.package.type as 'MONTHLY' | 'YEARLY' | 'PERMANENT',
      amount: subscription.package.amount,
      used: 0,
      expiresAt,
      source: 'subscription',
      sourceId: String(subscription.id),
      description: `${descriptionPrefix}${pkgName}`,
    },
  });

  const nextGrantDate = new Date(now.getTime() + grantIntervalDays * MS_PER_DAY);

  await tx.userTokenSubscription.update({
    where: { id: subscription.id },
    data: { nextGrantDate, grantsCount: { increment: 1 } },
  });

  await tx.queue.create({
    data: {
      name: 'grantSubscriptionTokens',
      payload: { subscriptionId: subscription.id, userId: subscription.userId },
      status: 'PENDING',
      priority: 5,
      runAt: nextGrantDate,
      maxAttempts: 3,
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
        return { success: false, skipped: true, reason: '套餐已停用' };
      }

      const { nextGrantDate } = await grantOnce(tx as unknown as DbClient, subscription, '套餐自动发放：');

      return {
        success: true,
        userId: subscription.userId,
        packageName: subscription.package.name,
        amount: subscription.package.amount,
        nextGrantDate,
      };
    }),

  /** 首次订阅时立即发放一次代币（与 processSubscriptionGrant 共用 grantOnce 核心） */
  grantFirstTime: (tx: DbClient, subscription: { id: number; userId: string; package: { type: string; amount: number; name: boolean | string } }) =>
    grantOnce(tx as Parameters<typeof grantOnce>[0], subscription, '订阅套餐：'),
};
