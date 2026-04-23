import type { DbClient } from '../Context/DbService';

/** 每批清理的代币数量 */
const BATCH_SIZE = 1000;

/**
 * 过期代币清理服务
 * 从 index.ts 中提取，使用纯 async 函数（队列/定时任务运行在非 Effect 上下文）
 */
export const TokenCleanupService = {
  /**
   * 清理已过期的代币记录（分批删除，避免长时间阻塞）
   * 只清理 used >= amount 的完全消耗代币
   */
  cleanupExpiredTokens: async (db: DbClient): Promise<number> => {
    const now = new Date();
    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      const tokensToCleanup = await db.token.findMany({
        where: {
          active: true,
          expiresAt: { lt: now },
        },
        select: { id: true, amount: true, used: true },
        take: BATCH_SIZE,
      });

      if (tokensToCleanup.length === 0) break;

      const fullyConsumed = tokensToCleanup.filter((t) => t.used >= t.amount);
      const partiallyConsumed = tokensToCleanup.filter((t) => t.used > 0 && t.used < t.amount);
      /** 从未使用的过期代币直接删除（无审计价值） */
      const neverUsed = tokensToCleanup.filter((t) => t.used === 0);

      // 三类操作互不重叠 ID 集合，安全并行执行
      await Promise.all([
        fullyConsumed.length > 0
          ? db.token.deleteMany({ where: { id: { in: fullyConsumed.map(t => t.id) } } })
          : Promise.resolve({ count: 0 }),
        partiallyConsumed.length > 0
          ? db.token.updateMany({
              where: { id: { in: partiallyConsumed.map(t => t.id) } },
              data: { active: false },
            })
          : Promise.resolve({ count: 0 }),
        neverUsed.length > 0
          ? db.token.deleteMany({ where: { id: { in: neverUsed.map(t => t.id) } } })
          : Promise.resolve({ count: 0 }),
      ]);

      totalDeleted += fullyConsumed.length + neverUsed.length;

      if (tokensToCleanup.length < BATCH_SIZE) hasMore = false;
    }

    return totalDeleted;
  },
};
