import { Effect } from 'effect';
import { AuthContext, requireAdmin } from '../../Context/Auth';
import { ReqCtxService } from '../../Context/ReqCtx';
import { dbTry } from '../../util/dbEffect';
import { MsgError } from '../../util/error';
import { TokenService } from '../../services/TokenService';
import { TokenPackageService } from '../../services/TokenPackageService';
import { TokenGrantService } from '../../services/TokenGrantService';
import { TokenType } from '../../../.zenstack/models';
import { MS_PER_DAY } from '../../util/constants';

/** 业务规则常量 */
const MAX_GRANT_AMOUNT = 1_000_000;
const MAX_DESCRIPTION_LENGTH = 500;
/** 合法的代币类型（与 schema.zmodel 枚举值同步） */
const VALID_TOKEN_TYPES: TokenType[] = ['MONTHLY', 'YEARLY', 'PERMANENT'];

/** 验证 userId 非空 */
function validateUserId(userId: string | undefined | null) {
  if (!userId || userId.trim().length === 0) {
    throw MsgError.msg('用户ID不能为空');
  }
}

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
    yield* requireAdmin();

    const tokenPackage = yield* TokenPackageService.createPackage(request);

    const reqCtx = yield* ReqCtxService;
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
    yield* requireAdmin();

    const tokenPackage = yield* TokenPackageService.updatePackage(packageId, request);

    const reqCtx = yield* ReqCtxService;
    reqCtx.log(`[TokenPackageAPI] 更新套餐 ${tokenPackage.id}`);

    return tokenPackage;
  });

/**
 * 删除代币套餐
 */
export const deleteTokenPackage = (packageId: number) =>
  Effect.gen(function* () {
    yield* requireAdmin();

    yield* TokenPackageService.deletePackage(packageId);

    const reqCtx = yield* ReqCtxService;
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
    yield* requireAdmin();
    const reqCtx = yield* ReqCtxService;

    // 严格的参数验证
    validateUserId(request.userId);

    if (request.amount <= 0) {
      throw MsgError.msg('代币数量必须大于0');
    }

    if (request.amount > MAX_GRANT_AMOUNT) {
      throw MsgError.msg('单次发放代币数量不能超过100万');
    }

    // 验证代币类型
    if (!VALID_TOKEN_TYPES.includes(request.type)) {
      throw MsgError.msg('无效的代币类型');
    }

    // 验证描述长度
    if (request.description && request.description.length > MAX_DESCRIPTION_LENGTH) {
      throw MsgError.msg(`描述不能超过${MAX_DESCRIPTION_LENGTH}字符`);
    }

    // 发放代币
    const userId = request.userId.trim();
    reqCtx.log('[TokenPackageAPI] 准备发放代币, userId=' + userId + ', amount=' + request.amount + ', type=' + request.type);

    yield* TokenService.grantTokens({
      userId,
      type: request.type,
      amount: request.amount,
      description: request.description?.trim() || '管理员手动发放',
      restrictedType: request.restrictedType,
    });

    reqCtx.log('[TokenPackageAPI] 发放代币完成');
  });

/**
 * 订阅套餐
 */
export const subscribePackage = (request: {
  userId: string;
  packageId: number;
}) =>
  Effect.gen(function* () {
    yield* requireAdmin();
    const reqCtx = yield* ReqCtxService;

    // 参数验证
    const userId = request.userId.trim();
    validateUserId(request.userId);

    if (request.packageId <= 0) {
      throw MsgError.msg('套餐ID必须大于0');
    }

    // 使用事务确保订阅和代币发放的原子性
    const auth = yield* AuthContext;
    const result = yield* dbTry('[TokenPackageAPI]', '订阅套餐事务', () =>
      auth.db.$transaction(async (tx) => {
        const [existingSubscription, tokenPackage] = await Promise.all([
          tx.userTokenSubscription.findFirst({
            where: { userId, packageId: request.packageId, active: true },
          }),
          tx.tokenPackage.findUnique({ where: { id: request.packageId } }),
        ]);

        if (existingSubscription) throw MsgError.msg('用户已订阅此套餐，请勿重复订阅');
        if (!tokenPackage) throw MsgError.msg('套餐不存在');
        if (!tokenPackage.active) throw MsgError.msg('套餐已停用');

        const now = new Date();
        let endDate: Date | null = null;
        if (tokenPackage.durationMonths > 0) {
          endDate = new Date(now.getTime() + tokenPackage.durationMonths * 30 * MS_PER_DAY);
        }

        const subscription = await tx.userTokenSubscription.create({
          data: {
            userId,
            packageId: request.packageId,
            startDate: now,
            endDate,
            nextGrantDate: now,
            active: true,
            grantsCount: 0,
          },
        });

        // 复用 TokenGrantService 的核心发放逻辑（创建代币、更新订阅、调度下次任务）
        await TokenGrantService.grantFirstTime(tx as unknown as import('../../Context/DbService').DbClient, {
          ...subscription,
          package: { type: tokenPackage.type, amount: tokenPackage.amount, name: tokenPackage.name },
        });

        return { subscription, tokenPackage };
      }),
    );

    reqCtx.log(
      `[TokenPackageAPI] 用户 ${userId} 订阅套餐 ${result.tokenPackage.name}，立即发放 ${result.tokenPackage.amount} 代币`,
    );

    return result.subscription;
  });

/**
 * 取消订阅
 */
export const cancelSubscription = (subscriptionId: number) =>
  Effect.gen(function* () {
    yield* requireAdmin();

    yield* TokenPackageService.cancelSubscription(subscriptionId);

    const reqCtx = yield* ReqCtxService;
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
