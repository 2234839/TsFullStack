import { Effect } from 'effect';
import { DbClientEffect } from '../Context/DbService';
import { dbTry, dbTryRequire } from '../util/dbEffect';
import { fail } from '../util/error';
import { TokenType } from '../../.zenstack/models';
import { DEFAULT_PAGE_SIZE_LARGE, MSG } from '../util/constants';

/** 日志前缀 */
const LOG_PREFIX = '[TokenPackageService]';

/**
 * 代币套餐服务
 *
 * 注意：本服务所有方法仅依赖 DbClientEffect（数据库客户端），
 * 不依赖 AuthContext（用户身份），因为 userId 均通过参数传入。
 * 权限控制由调用方（API 层）负责。
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
      const db = yield* DbClientEffect;

      // 验证参数
      if (!request.name?.trim()) {
        return yield* fail(MSG.PACKAGE_NAME_REQUIRED);
      }

      if (request.amount <= 0) {
        return yield* fail(MSG.TOKEN_AMOUNT_POSITIVE);
      }

      if (request.durationMonths && request.durationMonths < 0) {
        return yield* fail(MSG.PACKAGE_DURATION_INVALID);
      }

      // 创建套餐
      return yield* dbTry(LOG_PREFIX, '创建套餐', () =>
        db.tokenPackage.create({
          data: {
            name: request.name.trim(),
            description: request.description?.trim() || null,
            type: request.type,
            amount: request.amount,
            price: request.price ?? null,
            durationMonths: request.durationMonths ?? 0,
            sortOrder: request.sortOrder ?? 0,
            active: true,
          },
        }),
      );
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
      const db = yield* DbClientEffect;

      // 检查套餐是否存在（不存在则抛错）
      yield* dbTryRequire(LOG_PREFIX, '查询套餐', () =>
        db.tokenPackage.findUnique({
          where: { id: packageId },
        }),
        MSG.PACKAGE_NOT_FOUND,
      );

      // 更新套餐
      return yield* dbTry(LOG_PREFIX, '更新套餐', () =>
        db.tokenPackage.update({
          where: { id: packageId },
          data: {
            ...(request.name !== undefined && { name: request.name.trim() }),
            ...(request.description !== undefined && { description: request.description.trim() || null }),
            ...(request.amount !== undefined && { amount: request.amount }),
            ...(request.price !== undefined && { price: request.price ?? null }),
            ...(request.durationMonths !== undefined && { durationMonths: request.durationMonths }),
            ...(request.sortOrder !== undefined && { sortOrder: request.sortOrder }),
            ...(request.active !== undefined && { active: request.active }),
          },
        }),
      );
    }),

  /**
   * 删除代币套餐
   */
  deletePackage: (packageId: number) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;

      // 检查是否有用户订阅
      const subscriptionsCount = yield* dbTry(LOG_PREFIX, '查询订阅记录', () =>
        db.userTokenSubscription.count({
          where: {
            packageId,
            active: true,
          },
        }),
      );

      if (subscriptionsCount > 0) {
        return yield* fail(`还有 ${subscriptionsCount} 个活跃订阅，无法删除套餐`);
      }

      // 删除套餐
      yield* dbTry(LOG_PREFIX, '删除套餐', () =>
        db.tokenPackage.delete({
          where: { id: packageId },
        }),
      );
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
      const db = yield* DbClientEffect;
      return yield* dbTry(LOG_PREFIX, '获取套餐列表', () =>
        db.tokenPackage.findMany({
          where: options?.active !== undefined ? { active: options.active } : undefined,
          orderBy: { sortOrder: 'asc' },
          skip: options?.skip ?? 0,
          take: options?.take ?? DEFAULT_PAGE_SIZE_LARGE,
        }),
      );
    }),

  /**
   * 更新订阅的下一次发放时间
   */
  updateSubscriptionNextGrant: (subscriptionId: number, nextGrantDate: Date, grantsCount: number) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;
      return yield* dbTry(LOG_PREFIX, '更新订阅', () =>
        db.userTokenSubscription.update({
          where: { id: subscriptionId },
          data: {
            nextGrantDate,
            grantsCount,
          },
        }),
      );
    }),

  /**
   * 取消订阅
   */
  cancelSubscription: (subscriptionId: number) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;
      return yield* dbTry(LOG_PREFIX, '取消订阅', () =>
        db.userTokenSubscription.update({
          where: { id: subscriptionId },
          data: {
            active: false,
          },
        }),
      );
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
      const db = yield* DbClientEffect;
      return yield* dbTry(LOG_PREFIX, '获取订阅列表', () =>
        db.userTokenSubscription.findMany({
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
          skip: options?.skip ?? 0,
          take: options?.take ?? DEFAULT_PAGE_SIZE_LARGE,
        }),
      );
    }),
};
