import { Effect } from 'effect';
import { AuthContext } from '../../Context/Auth';
import { TokenService } from '../../services/TokenService';
import { DEFAULT_PAGE_SIZE } from '../../util/constants';

/**
 * 代币 API - 安全地暴露代币相关功能给前端
 *
 * 安全原则：
 * 1. 只暴露必要的查询功能
 * 2. 管理功能（发放代币）不暴露，通过管理员专用接口处理
 * 3. 消耗代币通过业务逻辑（如任务系统）间接调用，不直接暴露
 */

/** 获取当前用户的可用代币余额 */
const getAvailableTokens = () =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    return yield* TokenService.getAvailableTokens(auth.user.id);
  });

/** 获取当前用户的代币列表 */
const getUserTokens = (options?: {
  skip?: number;
  take?: number;
}) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    return yield* TokenService.getUserTokens(auth.user.id, {
      skip: options?.skip ?? 0,
      take: options?.take ?? DEFAULT_PAGE_SIZE,
    });
  });

/** 获取当前用户的代币使用历史 */
const getTokenHistory = (options?: {
  skip?: number;
  take?: number;
  startDate?: Date;
  endDate?: Date;
}) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    return yield* TokenService.getTokenHistory(auth.user.id, {
      skip: options?.skip ?? 0,
      take: options?.take ?? DEFAULT_PAGE_SIZE,
      startDate: options?.startDate,
      endDate: options?.endDate,
    });
  });

/**
 * 导出代币 API
 */
export const tokenApi = {
  getAvailableTokens,
  getUserTokens,
  getTokenHistory,
};
