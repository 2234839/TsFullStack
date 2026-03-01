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
}) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    const reqCtx = yield* ReqCtxService;

    // 只有管理员可以发放代币
    const isAdmin = auth.user.role?.some((r: { name: string }) => r.name === 'admin');
    if (!isAdmin) {
      throw MsgError.msg('无权操作');
    }

    if (request.amount <= 0) {
      throw MsgError.msg('代币数量必须大于0');
    }

    // 发放代币
    const token = yield* TokenService.grantTokens({
      userId: request.userId,
      type: request.type,
      amount: request.amount,
      description: request.description || '管理员手动发放',
    });

    reqCtx.log(
      `[TokenPackageAPI] 管理员 ${auth.user.id} 给用户 ${request.userId} 发放 ${request.amount} ${request.type} 代币`,
    );

    return token;
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

    // 创建订阅
    const { subscription, tokenPackage } = yield* TokenPackageService.subscribePackage(
      request.userId,
      request.packageId,
    );

    // 立即发放第一批代币
    yield* TokenService.grantTokens({
      userId: request.userId,
      type: tokenPackage.type,
      amount: tokenPackage.amount,
      source: 'subscription',
      sourceId: String(subscription.id),
      description: `订阅套餐：${tokenPackage.name}`,
    });

    // 更新订阅记录
    yield* TokenPackageService.updateSubscriptionNextGrant(
      subscription.id,
      getNextMonthFirst(),
      1,
    );

    reqCtx.log(
      `[TokenPackageAPI] 用户 ${request.userId} 订阅套餐 ${tokenPackage.name}，立即发放 ${tokenPackage.amount} 代币`,
    );

    return subscription;
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
 * 计算下个月1号
 */
function getNextMonthFirst(): Date {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next;
}

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
