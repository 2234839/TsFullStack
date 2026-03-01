import { Effect } from 'effect';
import { AuthContext } from '../Context/Auth';
import { MsgError } from '../util/error';
import { TokenType } from '../../.zenstack/models';

/**
 * 代币套餐服务
 */
export const TokenPackageService = {
  /**
   * 创建代币套餐
   */
  createPackage: (request: {
    name: string;
    description?: string;
    type: TokenType;
    amount: number;
    price?: number;
    durationMonths?: number;
    sortOrder?: number;
  }) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      // 验证参数
      if (!request.name || request.name.trim().length === 0) {
        throw MsgError.msg('套餐名称不能为空');
      }

      if (request.amount <= 0) {
        throw MsgError.msg('代币数量必须大于0');
      }

      if (request.durationMonths && request.durationMonths < 0) {
        throw MsgError.msg('套餐时长不能为负数');
      }

      // 创建套餐
      return yield* Effect.tryPromise({
        try: () =>
          auth.db.tokenPackage.create({
            data: {
              name: request.name.trim(),
              description: request.description?.trim() || null,
              type: request.type,
              amount: request.amount,
              price: request.price || null,
              durationMonths: request.durationMonths || 0,
              sortOrder: request.sortOrder || 0,
              active: true,
            },
          }),
        catch: (error) => {
          console.error('[TokenPackageService] 创建套餐失败:', error);
          throw MsgError.msg('创建套餐失败');
        },
      });
    }),

  /**
   * 更新代币套餐
   */
  updatePackage: (packageId: number, request: {
    name?: string;
    description?: string;
    amount?: number;
    price?: number;
    durationMonths?: number;
    sortOrder?: number;
    active?: boolean;
  }) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      // 检查套餐是否存在
      const existing = yield* Effect.tryPromise({
        try: () =>
          auth.db.tokenPackage.findUnique({
            where: { id: packageId },
          }),
        catch: () => {
          throw MsgError.msg('查询套餐失败');
        },
      });

      if (!existing) {
        throw MsgError.msg('套餐不存在');
      }

      // 更新套餐
      return yield* Effect.tryPromise({
        try: () =>
          auth.db.tokenPackage.update({
            where: { id: packageId },
            data: {
              ...(request.name !== undefined && { name: request.name.trim() }),
              ...(request.description !== undefined && { description: request.description.trim() || null }),
              ...(request.amount !== undefined && { amount: request.amount }),
              ...(request.price !== undefined && { price: request.price || null }),
              ...(request.durationMonths !== undefined && { durationMonths: request.durationMonths }),
              ...(request.sortOrder !== undefined && { sortOrder: request.sortOrder }),
              ...(request.active !== undefined && { active: request.active }),
            },
          }),
        catch: (error) => {
          console.error('[TokenPackageService] 更新套餐失败:', error);
          throw MsgError.msg('更新套餐失败');
        },
      });
    }),

  /**
   * 删除代币套餐
   */
  deletePackage: (packageId: number) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      // 检查是否有用户订阅
      const subscriptionsCount = yield* Effect.tryPromise({
        try: () =>
          auth.db.userTokenSubscription.count({
            where: {
              packageId,
              active: true,
            },
          }),
        catch: () => {
          throw MsgError.msg('查询订阅记录失败');
        },
      });

      if (subscriptionsCount > 0) {
        throw MsgError.msg(`还有 ${subscriptionsCount} 个活跃订阅，无法删除套餐`);
      }

      // 删除套餐
      yield* Effect.tryPromise({
        try: () =>
          auth.db.tokenPackage.delete({
            where: { id: packageId },
          }),
        catch: (error) => {
          console.error('[TokenPackageService] 删除套餐失败:', error);
          throw MsgError.msg('删除套餐失败');
        },
      });
    }),

  /**
   * 获取套餐列表
   */
  listPackages: (options?: {
    active?: boolean;
    skip?: number;
    take?: number;
  }) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      return yield* Effect.tryPromise({
        try: () =>
          auth.db.tokenPackage.findMany({
            where: options?.active !== undefined ? { active: options.active } : undefined,
            orderBy: { sortOrder: 'asc' },
            skip: options?.skip || 0,
            take: options?.take || 100,
          }),
        catch: () => {
          throw MsgError.msg('获取套餐列表失败');
        },
      });
    }),

  /**
   * 订阅套餐
   */
  subscribePackage: (userId: string, packageId: number) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      // 获取套餐信息
      const tokenPackage = yield* Effect.tryPromise({
        try: () =>
          auth.db.tokenPackage.findUnique({
            where: { id: packageId },
          }),
        catch: () => {
          throw MsgError.msg('查询套餐失败');
        },
      });

      if (!tokenPackage) {
        throw MsgError.msg('套餐不存在');
      }

      if (!tokenPackage.active) {
        throw MsgError.msg('套餐已停用');
      }

      // 计算下次发放时间
      const now = new Date();
      const startDate = now;
      const nextGrantDate = now;
      let endDate: Date | null = null;

      if (tokenPackage.durationMonths > 0) {
        endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + tokenPackage.durationMonths);
      }

      // 创建订阅
      const subscription = yield* Effect.tryPromise({
        try: () =>
          auth.db.userTokenSubscription.create({
            data: {
              userId,
              packageId,
              startDate,
              endDate,
              nextGrantDate,
              active: true,
              grantsCount: 0,
            },
          }),
        catch: (error) => {
          console.error('[TokenPackageService] 创建订阅失败:', error);
          throw MsgError.msg('创建订阅失败');
        },
      });

      return { subscription, tokenPackage };
    }),

  /**
   * 更新订阅的下一次发放时间
   */
  updateSubscriptionNextGrant: (subscriptionId: number, nextGrantDate: Date, grantsCount: number) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      yield* Effect.tryPromise({
        try: () =>
          auth.db.userTokenSubscription.update({
            where: { id: subscriptionId },
            data: {
              nextGrantDate,
              grantsCount,
            },
          }),
        catch: (error) => {
          console.error('[TokenPackageService] 更新订阅失败:', error);
          throw MsgError.msg('更新订阅失败');
        },
      });
    }),

  /**
   * 取消订阅
   */
  cancelSubscription: (subscriptionId: number) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      yield* Effect.tryPromise({
        try: () =>
          auth.db.userTokenSubscription.update({
            where: { id: subscriptionId },
            data: {
              active: false,
            },
          }),
        catch: (error) => {
          console.error('[TokenPackageService] 取消订阅失败:', error);
          throw MsgError.msg('取消订阅失败');
        },
      });
    }),

  /**
   * 获取用户订阅列表
   */
  listSubscriptions: (options?: {
    userId?: string;
    active?: boolean;
    skip?: number;
    take?: number;
  }) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      return yield* Effect.tryPromise({
        try: () =>
          auth.db.userTokenSubscription.findMany({
            where: {
              ...(options?.userId && { userId: options.userId }),
              ...(options?.active !== undefined && { active: options.active }),
            },
            include: {
              package: true,
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
            orderBy: { created: 'desc' },
            skip: options?.skip || 0,
            take: options?.take || 100,
          }),
        catch: () => {
          throw MsgError.msg('获取订阅列表失败');
        },
      });
    }),
};
