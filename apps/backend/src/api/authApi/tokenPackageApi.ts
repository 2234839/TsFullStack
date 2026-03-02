import { Effect } from 'effect';
import { AuthContext } from '../../Context/Auth';
import { ReqCtxService } from '../../Context/ReqCtx';
import { MsgError } from '../../util/error';
import { TokenService } from '../../services/TokenService';
import { TokenPackageService } from '../../services/TokenPackageService';
import { TokenType } from '../../../.zenstack/models';

/**
 * 创建代币套餐
 */
export const createTokenPackage = (request: {
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
    const reqCtx = yield* ReqCtxService;

    // 只有管理员可以创建套餐
    const isAdmin = auth.user.role?.some((r: { name: string }) => r.name === 'admin');
    if (!isAdmin) {
      throw MsgError.msg('无权操作');
    }

    const tokenPackage = yield* TokenPackageService.createPackage(request);

    reqCtx.log(`[TokenPackageAPI] 创建套餐 ${tokenPackage.id}: ${tokenPackage.name}`);

    return tokenPackage;
  });

/**
 * 更新代币套餐
 */
export const updateTokenPackage = (packageId: number, request: {
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
    const reqCtx = yield* ReqCtxService;

    // 只有管理员可以更新套餐
    const isAdmin = auth.user.role?.some((r: { name: string }) => r.name === 'admin');
    if (!isAdmin) {
      throw MsgError.msg('无权操作');
    }

    const tokenPackage = yield* TokenPackageService.updatePackage(packageId, request);

    reqCtx.log(`[TokenPackageAPI] 更新套餐 ${tokenPackage.id}`);

    return tokenPackage;
  });

/**
 * 删除代币套餐
 */
export const deleteTokenPackage = (packageId: number) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    const reqCtx = yield* ReqCtxService;

    // 只有管理员可以删除套餐
    const isAdmin = auth.user.role?.some((r: { name: string }) => r.name === 'admin');
    if (!isAdmin) {
      throw MsgError.msg('无权操作');
    }

    yield* TokenPackageService.deletePackage(packageId);

    reqCtx.log(`[TokenPackageAPI] 删除套餐 ${packageId}`);
  });

/**
 * 获取套餐列表
 */
export const listTokenPackages = (options?: {
  active?: boolean;
  skip?: number;
  take?: number;
}) => TokenPackageService.listPackages(options);

/**
 * 给用户发放代币（手动）
 */
export const grantTokens = (request: {
  userId: string;
  amount: number;
  type: TokenType;
  description?: string;
  restrictedType?: string[] | null;
}) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    const reqCtx = yield* ReqCtxService;

    // 只有管理员可以发放代币
    const isAdmin = auth.user.role?.some((r: { name: string }) => r.name === 'admin');
    if (!isAdmin) {
      throw MsgError.msg('无权操作');
    }

    // 严格的参数验证
    if (!request.userId || request.userId.trim().length === 0) {
      throw MsgError.msg('用户ID不能为空');
    }

    if (request.amount <= 0) {
      throw MsgError.msg('代币数量必须大于0');
    }

    if (request.amount > 1000000) {
      throw MsgError.msg('单次发放代币数量不能超过100万');
    }

    // 验证代币类型
    const validTokenTypes = ['MONTHLY', 'YEARLY', 'PERMANENT'];
    if (!validTokenTypes.includes(request.type)) {
      throw MsgError.msg('无效的代币类型');
    }

    // 验证描述长度
    if (request.description && request.description.length > 500) {
      throw MsgError.msg('描述不能超过500字符');
    }

    // 发放代币
    console.log('[TokenPackageAPI] 准备发放代币:', JSON.stringify({
      userId: request.userId.trim(),
      type: request.type,
      amount: request.amount,
      description: request.description?.trim() || '管理员手动发放',
      restrictedType: request.restrictedType,
    }, null, 2));

    yield* TokenService.grantTokens({
      userId: request.userId.trim(),
      type: request.type,
      amount: request.amount,
      description: request.description?.trim() || '管理员手动发放',
      restrictedType: request.restrictedType,
    });

    reqCtx.log(
      `[TokenPackageAPI] 管理员 ${auth.user.id} 给用户 ${request.userId} 发放 ${request.amount} ${request.type} 代币`,
    );
  });

/**
 * 订阅套餐
 */
export const subscribePackage = (request: {
  userId: string;
  packageId: number;
}) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    const reqCtx = yield* ReqCtxService;

    // 只有管理员可以替用户订阅
    const isAdmin = auth.user.role?.some((r: { name: string }) => r.name === 'admin');
    if (!isAdmin) {
      throw MsgError.msg('无权操作');
    }

    // 参数验证
    if (!request.userId || request.userId.trim().length === 0) {
      throw MsgError.msg('用户ID不能为空');
    }

    if (request.packageId <= 0) {
      throw MsgError.msg('套餐ID必须大于0');
    }

    // 使用事务确保订阅和代币发放的原子性
    const result = yield* Effect.tryPromise({
      try: () =>
        auth.db.$transaction(async (tx) => {
          // 检查是否已有活跃订阅（防止重复订阅）
          const existingSubscription = await tx.userTokenSubscription.findFirst({
            where: {
              userId: request.userId.trim(),
              packageId: request.packageId,
              active: true,
            },
          });

          if (existingSubscription) {
            throw new Error('用户已订阅此套餐，请勿重复订阅');
          }

          // 获取套餐信息（加锁）
          const tokenPackage = await tx.tokenPackage.findUnique({
            where: { id: request.packageId },
          });

          if (!tokenPackage) {
            throw new Error('套餐不存在');
          }

          if (!tokenPackage.active) {
            throw new Error('套餐已停用');
          }

          // 计算下次发放时间（使用UTC避免时区问题）
          const now = new Date();
          const startDate = now;
          const nextGrantDate = now;
          let endDate: Date | null = null;

          if (tokenPackage.durationMonths > 0) {
            endDate = new Date(Date.UTC(
              now.getUTCFullYear(),
              now.getUTCMonth() + tokenPackage.durationMonths,
              now.getUTCDate(),
              23,
              59,
              59,
              999
            ));
          }

          // 创建订阅
          const subscription = await tx.userTokenSubscription.create({
            data: {
              userId: request.userId.trim(),
              packageId: request.packageId,
              startDate,
              endDate,
              nextGrantDate,
              active: true,
              grantsCount: 0,
            },
          });

          // 计算过期时间（使用UTC避免时区问题）
          let expiresAt: Date | undefined;
          if (tokenPackage.type === 'MONTHLY') {
            const year = now.getUTCFullYear();
            const month = now.getUTCMonth() + 1;
            const lastDayOfCurrentMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
            expiresAt = lastDayOfCurrentMonth;
          } else if (tokenPackage.type === 'YEARLY') {
            const year = now.getUTCFullYear();
            const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
            expiresAt = endOfYear;
          }

          // 立即发放第一批代币（在事务内）
          await tx.token.create({
            data: {
              userId: request.userId.trim(),
              type: tokenPackage.type as any,
              amount: tokenPackage.amount,
              used: 0,
              expiresAt,
              source: 'subscription',
              sourceId: String(subscription.id),
              description: `订阅套餐：${tokenPackage.name}`,
            },
          });

          // 更新订阅记录（下次发放时间为下个月1号）
          const nextMonthFirst = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth() + 1,
            1,
            0,
            0,
            0,
            0
          ));

          await tx.userTokenSubscription.update({
            where: { id: subscription.id },
            data: {
              nextGrantDate: nextMonthFirst,
              grantsCount: 1,
            },
          });

          return { subscription, tokenPackage };
        }),
      catch: (error) => {
        console.error('[TokenPackageAPI] 订阅套餐失败:', error);
        throw MsgError.msg(
          error instanceof Error ? error.message : '订阅套餐失败'
        );
      },
    });

    reqCtx.log(
      `[TokenPackageAPI] 用户 ${request.userId} 订阅套餐 ${result.tokenPackage.name}，立即发放 ${result.tokenPackage.amount} 代币`,
    );

    return result.subscription;
  });

/**
 * 取消订阅
 */
export const cancelSubscription = (subscriptionId: number) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    const reqCtx = yield* ReqCtxService;

    // 只有管理员可以取消订阅
    const isAdmin = auth.user.role?.some((r: { name: string }) => r.name === 'admin');
    if (!isAdmin) {
      throw MsgError.msg('无权操作');
    }

    yield* TokenPackageService.cancelSubscription(subscriptionId);

    reqCtx.log(`[TokenPackageAPI] 取消订阅 ${subscriptionId}`);
  });

/**
 * 获取用户订阅列表
 */
export const listUserSubscriptions = (options?: {
  userId?: string;
  active?: boolean;
  skip?: number;
  take?: number;
}) => TokenPackageService.listSubscriptions(options);

/**
 * 套餐管理 API
 */
export const tokenPackageApi = {
  createTokenPackage,
  updateTokenPackage,
  deleteTokenPackage,
  listTokenPackages,
  grantTokens,
  subscribePackage,
  cancelSubscription,
  listUserSubscriptions,
};
