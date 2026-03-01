import { Effect } from 'effect';
import { AuthContext } from '../Context/Auth';
import { MsgError } from '../util/error';
import { TokenType } from '../../.zenstack/models';

/**
 * 代币消耗结果
 */
export interface TokenConsumptionResult {
  /** 消耗明细 */
  details: {
    type: string;
    amount: number;
  }[];
  /** 总消耗 */
  total: number;
  /** 剩余额度 */
  remaining: {
    monthly: number;
    yearly: number;
    permanent: number;
  };
}

/**
 * 代币服务
 */
export const TokenService = {
  /**
   * 查询用户的活跃代币（内部辅助函数）
   */
  findActiveTokens: (userId: string, tokenType?: TokenType) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      return yield* Effect.tryPromise({
        try: () =>
          auth.db.token.findMany({
            where: {
              userId,
              ...(tokenType && { type: tokenType }),
              active: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gte: new Date() } },
              ],
            },
          }),
        catch: (error) => {
          console.error('[TokenService] 查询代币失败:', error);
          throw MsgError.msg('查询代币失败');
        },
      });
    }),

  /**
   * 获取用户可用代币总额
   */
  getAvailableTokens: (userId: string) =>
    Effect.gen(function* () {
      // 查询用户的所有代币
      const tokens = yield* TokenService.findActiveTokens(userId);

      // 计算每种类型的可用代币
      const monthly = tokens
        .filter(t => t.type === TokenType.MONTHLY)
        .reduce((sum, t) => sum + (t.amount - t.used), 0);

      const yearly = tokens
        .filter(t => t.type === TokenType.YEARLY)
        .reduce((sum, t) => sum + (t.amount - t.used), 0);

      const permanent = tokens
        .filter(t => t.type === TokenType.PERMANENT)
        .reduce((sum, t) => sum + (t.amount - t.used), 0);

      return {
        monthly,
        yearly,
        permanent,
        total: monthly + yearly + permanent,
      };
    }),

  /**
   * 检查代币是否足够
   */
  checkTokens: (userId: string, amount: number): Effect.Effect<
    boolean,
    Error,
    AuthContext
  > =>
    Effect.gen(function* () {
      const available = yield* TokenService.getAvailableTokens(userId);

      if (available.total < amount) {
        return false;
      }

      return true;
    }),

  /**
   * 消耗代币（支持组合消耗）
   */
  consumeTokens: (userId: string, amount: number, taskId: number): Effect.Effect<
    TokenConsumptionResult,
    Error | void,
    AuthContext
  > =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      // 1. 检查代币是否足够
      const available = yield* TokenService.getAvailableTokens(userId);

      if (available.total < amount) {
        throw MsgError.msg(
          `代币不足！需要 ${amount} 枚，但只有 ${available.total} 枚可用\n` +
          `（月度: ${available.monthly}, 年度: ${available.yearly}, 永久: ${available.permanent}）`
        );
      }

      // 2. 按优先级消耗代币（月度 > 年度 > 永久）
      const details: TokenConsumptionResult['details'] = [];
      let remainingToConsume = amount;

      // 定义消耗优先级
      const priority: Array<TokenType> = [TokenType.MONTHLY, TokenType.YEARLY, TokenType.PERMANENT];

      for (const tokenType of priority) {
        if (remainingToConsume <= 0) break;

        // 查找该类型的代币
        const tokens = yield* TokenService.findActiveTokens(userId, tokenType);

        for (const token of tokens) {
          if (remainingToConsume <= 0) break;

          const available = token.amount - token.used;
          const toConsume = Math.min(available, remainingToConsume);

          if (toConsume > 0) {
            // 更新代币使用量
            yield* Effect.tryPromise({
              try: () =>
                auth.db.token.update({
                  where: { id: token.id },
                  data: { used: token.used + toConsume },
                }),
              catch: (error) => {
                console.error('[TokenService] 更新代币失败:', error);
                throw MsgError.msg('更新代币失败');
              },
            });

            // 记录消耗明细
            details.push({
              type: tokenType,
              amount: toConsume,
            });

            remainingToConsume -= toConsume;
          }
        }
      }

      // 3. 创建代币消耗记录
      const newTransactions = details.map((detail) => ({
        amount: detail.amount,
        tokenType: detail.type as any,
        userId,
        taskId,
        balanceSnapshot: available as any,
        note: `任务 ${taskId} 消耗 ${detail.amount} ${detail.type} 代币`,
      }));

      yield* Effect.tryPromise({
        try: () =>
          auth.db.tokenTransaction.createMany({
            data: newTransactions,
          }),
        catch: (error) => {
          console.error('[TokenService] 创建消耗记录失败:', error);
          // 消耗记录创建失败不影响主流程
        },
      });

      // 4. 获取消耗后的剩余额度
      const remaining = yield* TokenService.getAvailableTokens(userId);

      return {
        details,
        total: amount,
        remaining,
      };
    }),

  /**
   * 发放代币
   */
  grantTokens: (params: {
    /** 用户ID */
    userId: string;
    /** 代币类型 */
    type: string;
    /** 代币数量 */
    amount: number;
    /** 来源 */
    source?: string;
    /** 来源ID */
    sourceId?: string;
    /** 描述 */
    description?: string;
    /** 过期时间（可选，默认根据类型自动计算） */
    expiresAt?: Date;
  }) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      const { userId, type, amount, source, sourceId, description } = params;

      // 计算过期时间
      let expiresAt: Date | undefined = params.expiresAt;
      if (type === TokenType.MONTHLY) {
        // 月度代币：本月底过期
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        expiresAt = endOfMonth;
      } else if (type === TokenType.YEARLY) {
        // 年度代币：今年年底过期
        const now = new Date();
        const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        expiresAt = endOfYear;
      }
      // PERMANENT 代币不过期

      // 检查是否已有该类型的未过期代币
      const existing = yield* Effect.tryPromise({
        try: () =>
          auth.db.token.findFirst({
            where: {
              userId,
              type: type as any,
              active: true,
              ...(expiresAt ? { expiresAt: { gte: expiresAt } } : {}),
            },
          }),
        catch: () => null,
      });

      if (existing) {
        // 更新现有代币
        yield* Effect.tryPromise({
          try: () =>
            auth.db.token.update({
              where: { id: existing.id },
              data: {
                amount: existing.amount + amount,
              },
            }),
          catch: (error) => {
            console.error('[TokenService] 更新代币失败:', error);
            throw MsgError.msg('更新代币失败');
          },
        });
      } else {
        // 创建新代币
        yield* Effect.tryPromise({
          try: () =>
            auth.db.token.create({
              data: {
                userId,
                type: type as any,
                amount,
                used: 0,
                expiresAt,
                source: source || 'system',
                sourceId,
                description,
              },
            }),
          catch: (error) => {
            console.error('[TokenService] 创建代币失败:', error);
            throw MsgError.msg('创建代币失败');
          },
        });
      }
    }),
};
