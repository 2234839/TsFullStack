import { Effect } from 'effect';
import { AuthContext, requireAdmin } from '../../Context/Auth';
import { ReqCtxService } from '../../Context/ReqCtx';
import { dbTry } from '../../util/dbEffect';
import { MsgError, fail } from '../../util/error';
import { TokenService } from '../../services/TokenService';
import { TokenPackageService } from '../../services/TokenPackageService';
import { TokenGrantService, asGrantTx } from '../../services/TokenGrantService';
import { TokenType } from '../../../.zenstack/models';
import { MS_PER_DAY, DAYS_PER_MONTH_APPROX, MSG } from '../../util/constants';

/** 日志前缀 */
const LOG_PREFIX = '[TokenPackageApi]';

/** 业务规则常量 */
const MAX_GRANT_AMOUNT = 1_000_000;
const MAX_DESCRIPTION_LENGTH = 500;
/** 合法的代币类型（与 schema.zmodel 枚举值同步） */
const VALID_TOKEN_TYPES: TokenType[] = ['MONTHLY', 'YEARLY', 'PERMANENT'];

/** 验证 userId 非空 */
const validateUserId = (userId: string | undefined | null) =>
  (!userId?.trim()) ? fail(MSG.USER_ID_REQUIRED) : Effect.void;

/**
 * 创建代币套餐
 */
const createTokenPackage = (request: {
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
    reqCtx.log(`${LOG_PREFIX} 创建套餐 ${tokenPackage.id}: ${tokenPackage.name}`);
    return tokenPackage;
  });

/**
 * 更新代币套餐
 */
const updateTokenPackage = (packageId: number, request: {
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
    reqCtx.log(`${LOG_PREFIX} 更新套餐 ${tokenPackage.id}`);
    return tokenPackage;
  });

/**
 * 删除代币套餐
 */
const deleteTokenPackage = (packageId: number) =>
  Effect.gen(function* () {
    yield* requireAdmin();
    yield* TokenPackageService.deletePackage(packageId);
    const reqCtx = yield* ReqCtxService;
    reqCtx.log(`${LOG_PREFIX} 删除套餐 ${packageId}`);
  });

/**
 * 获取套餐列表
 */
const listTokenPackages = (options?: {
  active?: boolean;
  skip?: number;
  take?: number;
}) => TokenPackageService.listPackages(options);

/**
 * 给用户发放代币（手动）
 */
const grantTokens = (request: {
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
    yield* validateUserId(request.userId);

    if (request.amount <= 0) {
      return yield* fail(MSG.TOKEN_AMOUNT_POSITIVE);
    }

    if (request.amount > MAX_GRANT_AMOUNT) {
      return yield* fail(MSG.TOKEN_GRANT_LIMIT_EXCEEDED);
    }

    // 验证代币类型
    if (!VALID_TOKEN_TYPES.includes(request.type)) {
      return yield* fail(MSG.INVALID_TOKEN_TYPE);
    }

    // 验证描述长度
    if (request.description && request.description.length > MAX_DESCRIPTION_LENGTH) {
      return yield* fail(`描述不能超过${MAX_DESCRIPTION_LENGTH}字符`);
    }

    // 发放代币
    const userId = request.userId.trim();
    reqCtx.log(`${LOG_PREFIX} 准备发放代币, userId=${userId}, amount=${request.amount}, type=${request.type}`);

    yield* TokenService.grantTokens({
      userId,
      type: request.type,
      amount: request.amount,
      description: request.description?.trim() || '管理员手动发放',
      restrictedType: request.restrictedType,
    });

    reqCtx.log(`${LOG_PREFIX} 发放代币完成`);
  });

/**
 * 订阅套餐
 */
const subscribePackage = (request: {
  userId: string;
  packageId: number;
}) =>
  Effect.gen(function* () {
    yield* requireAdmin();
    const reqCtx = yield* ReqCtxService;

    // 参数验证（先 trim 再校验）
    const userId = request.userId.trim();
    yield* validateUserId(userId);

    if (request.packageId <= 0) {
      return yield* fail(MSG.PACKAGE_ID_MUST_BE_POSITIVE);
    }

    // 使用事务确保订阅和代币发放的原子性
    const auth = yield* AuthContext;
    const result = yield* dbTry(LOG_PREFIX, '订阅套餐事务', () =>
      auth.db.$transaction(async (tx) => {
        const [existingSubscription, tokenPackage] = await Promise.all([
          tx.userTokenSubscription.findFirst({
            where: { userId, packageId: request.packageId, active: true },
          }),
          tx.tokenPackage.findUnique({ where: { id: request.packageId } }),
        ]);

        if (existingSubscription) throw MsgError.msg(MSG.SUBSCRIPTION_ALREADY_EXISTS);
        if (!tokenPackage) throw MsgError.msg(MSG.PACKAGE_NOT_FOUND);
        if (!tokenPackage.active) throw MsgError.msg(MSG.PACKAGE_DISABLED);

        const now = new Date();
        let endDate: Date | null = null;
        if (tokenPackage.durationMonths > 0) {
          endDate = new Date(now.getTime() + tokenPackage.durationMonths * DAYS_PER_MONTH_APPROX * MS_PER_DAY);
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
        await TokenGrantService.grantFirstTime(asGrantTx(tx), {
          ...subscription,
          package: { type: tokenPackage.type, amount: tokenPackage.amount, name: tokenPackage.name },
        });

        return { subscription, tokenPackage };
      }),
    );

    reqCtx.log(
      `${LOG_PREFIX} 用户 ${userId} 订阅套餐 ${result.tokenPackage.name}，立即发放 ${result.tokenPackage.amount} 代币`,
    );

    return result.subscription;
  });

/**
 * 取消订阅
 */
const cancelSubscription = (subscriptionId: number) =>
  Effect.gen(function* () {
    yield* requireAdmin();
    yield* TokenPackageService.cancelSubscription(subscriptionId);
    const reqCtx = yield* ReqCtxService;
    reqCtx.log(`${LOG_PREFIX} 取消订阅 ${subscriptionId}`);
  });

/**
 * 获取用户订阅列表（需要管理员权限）
 */
const listUserSubscriptions = (options?: {
  userId?: string;
  active?: boolean;
  skip?: number;
  take?: number;
}) =>
  Effect.gen(function* () {
    yield* requireAdmin();
    return yield* TokenPackageService.listSubscriptions(options);
  });

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
