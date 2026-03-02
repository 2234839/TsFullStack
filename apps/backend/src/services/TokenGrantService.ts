import { Effect } from 'effect';
import { AuthContext } from '../Context/Auth';
import { ReqCtxService } from '../Context/ReqCtx';
import { MsgError } from '../util/error';

/**
 * 代币发放服务
 */
export const TokenGrantService = {
  /**
   * 处理订阅代币的定时发放
   * 这个方法会被队列任务调用
   */
  processSubscriptionGrant: (payload: {
    subscriptionId: number;
    userId: string;
  }) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;
      const reqCtx = yield* ReqCtxService;

      // 查询订阅记录
      const subscription = yield* Effect.tryPromise({
        try: () =>
          auth.db.userTokenSubscription.findFirst({
            where: {
              id: payload.subscriptionId,
              userId: payload.userId,
              active: true,
            },
            include: {
              package: true,
            },
          }),
        catch: () => {
          throw MsgError.msg('查询订阅记录失败');
        },
      });

      if (!subscription) {
        reqCtx.log(`[TokenGrant] 订阅 ${payload.subscriptionId} 不存在或已取消，跳过发放`);
        return { skipped: true, reason: '订阅不存在或已取消' };
      }

      // 检查订阅是否已过期
      if (subscription.endDate && new Date() > subscription.endDate) {
        reqCtx.log(`[TokenGrant] 订阅 ${payload.subscriptionId} 已过期，跳过发放`);

        // 停用订阅
        yield* Effect.tryPromise({
          try: () =>
            auth.db.userTokenSubscription.update({
              where: { id: subscription.id },
              data: { active: false },
            }),
          catch: () => {
            throw MsgError.msg('更新订阅状态失败');
          },
        });

        return { skipped: true, reason: '订阅已过期' };
      }

      // 检查套餐是否启用
      if (!subscription.package.active) {
        reqCtx.log(`[TokenGrant] 套餐 ${subscription.package.id} 已停用，跳过发放`);
        return { skipped: true, reason: '套餐已停用' };
      }

      // 计算发放周期和过期时间
      const grantIntervalDays = subscription.package.type === 'MONTHLY' ? 30 : 365;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + grantIntervalDays * 24 * 60 * 60 * 1000);

      // 发放代币
      yield* Effect.tryPromise({
        try: () =>
          auth.db.token.create({
            data: {
              userId: subscription.userId,
              type: subscription.package.type as any,
              amount: subscription.package.amount,
              used: 0,
              expiresAt,
              source: 'subscription',
              sourceId: String(subscription.id),
              description: `套餐自动发放：${subscription.package.name}`,
            },
          }),
        catch: (error) => {
          reqCtx.log('[TokenGrant] 创建代币记录失败:', String(error));
          throw MsgError.msg('创建代币记录失败');
        },
      });

      // 计算下次发放时间
      const nextGrantDate = new Date(now.getTime() + grantIntervalDays * 24 * 60 * 60 * 1000);

      // 更新订阅记录
      yield* Effect.tryPromise({
        try: () =>
          auth.db.userTokenSubscription.update({
            where: { id: subscription.id },
            data: {
              nextGrantDate,
              grantsCount: { increment: 1 },
            },
          }),
        catch: (error) => {
          reqCtx.log('[TokenGrant] 更新订阅记录失败:', String(error));
          throw MsgError.msg('更新订阅记录失败');
        },
      });

      // 创建下一次的定时发放任务
      yield* Effect.tryPromise({
        try: () =>
          auth.db.queue.create({
            data: {
              name: 'grantSubscriptionTokens',
              payload: {
                subscriptionId: subscription.id,
                userId: subscription.userId,
              },
              status: 'PENDING',
              priority: 5,
              runAt: nextGrantDate,
              maxAttempts: 3,
            },
          }),
        catch: (error) => {
          reqCtx.log('[TokenGrant] 创建下次发放任务失败:', String(error));
          // 这里不抛出错误，因为代币已经发放成功
        },
      });

      reqCtx.log(
        `[TokenGrant] 用户 ${subscription.userId} 的订阅 ${subscription.package.name} 自动发放 ${subscription.package.amount} 代币，下次发放时间: ${nextGrantDate.toISOString()}`,
      );

      return {
        success: true,
        userId: subscription.userId,
        packageName: subscription.package.name,
        amount: subscription.package.amount,
        nextGrantDate,
      };
    }),
};
