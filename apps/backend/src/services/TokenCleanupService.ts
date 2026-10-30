import { Effect } from 'effect';
import { tryOrFail } from '../util/error';
import type { DbClient } from '../Context/DbService';

/** 每批清理的代币数量 */
const BATCH_SIZE = 1000;
/** 安全限制：最多迭代次数，防止并发插入导致无限循环 */
const MAX_ITERATIONS = 100;

/**
 * 过期代币清理服务
 * 返回 Effect，错误走 E 通道由调用方（index.ts 定时 Fiber）统一处理
 */
export const TokenCleanupService = {
  /**
   * 清理已过期的代币记录（分批删除，避免长时间阻塞）
   * 只清理 used >= amount 的完全消耗代币
   */
  cleanupExpiredTokens: (db: DbClient): Effect.Effect<number, Error> =>
    Effect.gen(function* () {
      const now = new Date();
      let totalDeleted = 0;
      let hasMore = true;
      let iterations = 0;

      while (hasMore && iterations++ < MAX_ITERATIONS) {
        const tokensToCleanup = yield* tryOrFail('清理过期代币/查询批次', () =>
          db.token.findMany({
            where: {
              active: true,
              expiresAt: { lt: now },
            },
            select: { id: true, amount: true, used: true },
            orderBy: { id: 'asc' },
            take: BATCH_SIZE,
          }),
        );

        if (tokensToCleanup.length === 0) break;

        const fullyConsumed: typeof tokensToCleanup = [];
        const partiallyConsumed: typeof tokensToCleanup = [];
        const neverUsed: typeof tokensToCleanup = [];
        for (const t of tokensToCleanup) {
          if (t.used >= t.amount) fullyConsumed.push(t);
          else if (t.used > 0) partiallyConsumed.push(t);
          else neverUsed.push(t);
        }

        /** 三类操作互不重叠 ID 集合，安全并行执行 */
        yield* Effect.all(
          [
            fullyConsumed.length > 0
              ? tryOrFail('清理过期代币/删除完全消耗', () =>
                  db.token.deleteMany({ where: { id: { in: fullyConsumed.map((t) => t.id) } } }),
                )
              : Effect.succeed({ count: 0 }),
            partiallyConsumed.length > 0
              ? tryOrFail('清理过期代币/停用部分消耗', () =>
                  db.token.updateMany({
                    where: { id: { in: partiallyConsumed.map((t) => t.id) } },
                    data: { active: false },
                  }),
                )
              : Effect.succeed({ count: 0 }),
            neverUsed.length > 0
              ? tryOrFail('清理过期代币/删除从未使用', () =>
                  db.token.deleteMany({ where: { id: { in: neverUsed.map((t) => t.id) } } }),
                )
              : Effect.succeed({ count: 0 }),
          ],
          { concurrency: 'unbounded' },
        );

        totalDeleted += fullyConsumed.length + neverUsed.length;

        if (tokensToCleanup.length < BATCH_SIZE) hasMore = false;
      }

      return totalDeleted;
    }),
};
