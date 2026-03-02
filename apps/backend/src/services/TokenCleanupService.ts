import { Effect } from 'effect';
import { AuthContext } from '../Context/Auth';
import { ReqCtxService } from '../Context/ReqCtx';
import { MsgError } from '../util/error';

/**
 * 代币清理服务
 * 定期清理过期且用完的代币记录
 */
export const TokenCleanupService = {
  /**
   * 清理过期且已用完的代币
   * 只清理满足以下条件的代币：
   * 1. 已过期 (expiresAt < now)
   * 2. 已完全使用 (used >= amount 且 amount > 0)
   * 3. 仍然激活 (active = true)
   */
  cleanupExpiredTokens: () =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;
      const reqCtx = yield* ReqCtxService;

      const now = new Date();

      // 分批清理以减少内存消耗（每次最多处理1000条）
      const BATCH_SIZE = 1000;
      let totalDeleted = 0;
      let hasMore = true;

      while (hasMore) {
        // 每次只查询一批数据
        const tokensToCleanup = yield* Effect.tryPromise({
          try: () =>
            auth.db.token.findMany({
              where: {
                active: true,
                expiresAt: { lt: now }, // 已过期
              },
              select: {
                id: true,
                amount: true,
                used: true,
              },
              take: BATCH_SIZE,
            }),
          catch: (error) => {
            reqCtx.log('[TokenCleanupService] 查询过期代币失败:', String(error));
            return [];
          },
        });

        if (tokensToCleanup.length === 0) {
          hasMore = false;
          break;
        }

        // 在应用层精确过滤：used >= amount 表示已完全使用
        const tokenIdsToDelete = tokensToCleanup
          .filter(t => t.used >= t.amount)
          .map(t => t.id);

        if (tokenIdsToDelete.length > 0) {
          yield* Effect.tryPromise({
            try: () =>
              auth.db.token.deleteMany({
                where: {
                  id: { in: tokenIdsToDelete },
                },
              }),
            catch: (error) => {
              reqCtx.log('[TokenCleanupService] 清理失败:', String(error));
              // 清理失败不影响主流程
            },
          });

          totalDeleted += tokenIdsToDelete.length;
        }

        // 如果返回的数量少于BATCH_SIZE，说明没有更多数据了
        if (tokensToCleanup.length < BATCH_SIZE) {
          hasMore = false;
        }
      }

      return { cleaned: true, count: totalDeleted };
    }),

  /**
   * 获取清理统计信息
   */
  getCleanupStats: () =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      const [expiredTokens, zeroBalanceTokens, totalTokens] = yield* Effect.all([
        Effect.tryPromise(() =>
          auth.db.token.count({
            where: {
              active: true,
              expiresAt: { lt: new Date() },
            },
          })
        ),
        Effect.tryPromise(() =>
          auth.db.token.count({
            where: {
              active: true,
              amount: { lte: 0 },
            },
          })
        ),
        Effect.tryPromise(() =>
          auth.db.token.count({
            where: { active: true },
          })
        ),
      ]);

      return {
        expired: expiredTokens,
        zeroBalance: zeroBalanceTokens,
        total: totalTokens,
      };
    }),
};
