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

/**
 * 获取当前用户的可用代币余额
 * @returns Promise<{ monthly: number; yearly: number; permanent: number; total: number }>
 */
export const getAvailableTokens = () =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;

    // 从认证上下文获取当前用户ID，确保用户只能查询自己的余额
    return yield* TokenService.getAvailableTokens(auth.user.id);
  });

/**
 * 获取当前用户的代币列表
 * @param options - 查询选项
 * @returns Promise<{ tokens: Token[], total: number }> - 代币列表和总数
 */
export const getUserTokens = (options?: {
  skip?: number;
  take?: number;
}) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;

    // 从认证上下文获取当前用户ID，确保用户只能查询自己的代币
    return yield* TokenService.getUserTokens(auth.user.id, {
      skip: options?.skip || 0,
      take: options?.take || DEFAULT_PAGE_SIZE,
    });
  });

/**
 * 获取当前用户的代币使用历史
 * @param options - 查询选项
 * @returns Promise<{ transactions: TokenTransaction[], total: number }> - 代币交易记录列表和总数
 */
export const getTokenHistory = (options?: {
  skip?: number;
  take?: number;
  startDate?: Date;
  endDate?: Date;
}) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;

    // 确保用户只能查询自己的历史记录
    return yield* TokenService.getTokenHistory(auth.user.id, {
      skip: options?.skip || 0,
      take: options?.take || DEFAULT_PAGE_SIZE,
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
