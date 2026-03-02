import { Effect } from 'effect';
import { AuthContext } from '../Context/Auth';
import { ReqCtxService } from '../Context/ReqCtx';
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
          console.error('[TokenService] 错误详情:', JSON.stringify(error, null, 2));
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
   *
   * 消耗优先级：
   * 1. 专用代币（restrictedType 匹配任务类型）
   * 2. 月度代币（MONTHLY）
   * 3. 年度代币（YEARLY）
   * 4. 永久代币（PERMANENT）
   */
  consumeTokens: (userId: string, amount: number, taskId: number): Effect.Effect<
    TokenConsumptionResult,
    Error | void,
    AuthContext | ReqCtxService
  > =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;
      const reqCtx = yield* ReqCtxService;

      // 0. 查询任务信息，获取任务类型
      const task = yield* Effect.tryPromise({
        try: () =>
          auth.db.task.findUnique({
            where: { id: taskId },
            select: { type: true },
          }),
        catch: (error) => {
          console.error('[TokenService] 查询任务失败:', error);
          throw MsgError.msg('查询任务失败');
        },
      });

      if (!task) {
        throw MsgError.msg('任务不存在');
      }

      const taskType = task.type;

      // 1. 检查代币是否足够（包括专用代币和通用代币）
      const allTokens = yield* TokenService.findActiveTokens(userId);

      // 辅助函数：检查代币是否可用于指定任务类型
      const canUseForTask = (token: typeof allTokens[0], taskType: string): boolean => {
        // restrictedType 是 Json 类型（存储为 JSON 字符串），需要安全地解析
        let restricted: unknown;

        try {
          // 尝试解析 JSON 字符串
          restricted = token.restrictedType ? JSON.parse(token.restrictedType as string) : null;
        } catch {
          // 解析失败，当作 null 处理
          restricted = null;
        }

        // null 或空数组 = 通用代币，可用于所有任务
        if (!restricted || (typeof restricted === 'object' && Array.isArray(restricted) && restricted.length === 0)) {
          return true;
        }

        // 非空数组，检查是否包含当前任务类型
        if (Array.isArray(restricted)) {
          return restricted.includes(taskType);
        }

        // 其他情况（字符串）向后兼容
        return restricted === taskType;
      };

      // 分离专用代币和通用代币
      const restrictedTokens = allTokens.filter((t) => canUseForTask(t, taskType) && !canUseForTask(t, ''));
      const generalTokens = allTokens.filter((t) => canUseForTask(t, ''));

      // 🔍 调试日志：输出代币详情
      reqCtx.log(`[TokenService] 🔍 调试信息：`);
      reqCtx.log(`[TokenService] 任务类型: ${taskType}`);
      reqCtx.log(`[TokenService] 所有代币数量: ${allTokens.length}`);
      allTokens.forEach(t => {
        reqCtx.log(`[TokenService] 代币: id=${t.id}, type=${t.type}, amount=${t.amount}, used=${t.used}, available=${t.amount - t.used}, restrictedType=${t.restrictedType}, canUseForTask=${canUseForTask(t, taskType)}, isGeneral=${canUseForTask(t, '')}`);
      });
      reqCtx.log(`[TokenService] 专用代币数量: ${restrictedTokens.length}`);
      reqCtx.log(`[TokenService] 通用代币数量: ${generalTokens.length}`);

      // 计算总可用代币
      let totalAvailable = 0;
      for (const token of [...restrictedTokens, ...generalTokens]) {
        totalAvailable += token.amount - token.used;
      }

      reqCtx.log(`[TokenService] 总可用代币: ${totalAvailable}`);
      reqCtx.log(`[TokenService] 需要代币: ${amount}`);

      if (totalAvailable < amount) {
        throw MsgError.msg(
          `代币不足！需要 ${amount} 枚，但只有 ${totalAvailable} 枚可用`
        );
      }

      // 2. 按优先级消耗代币
      const details: TokenConsumptionResult['details'] = [];
      let remainingToConsume = amount;

      /**
       * 代币优先级计算
       *
       * 设计理念：
       * 1. 专用代币优先消耗（避免浪费专用额度）
       * 2. 同样专一度下，有效期短的优先（避免过期浪费）
       *
       * 优先级分数（越小越优先）：
       * - 专用月度: 1  (专用 + 有效期最短)
       * - 专用年度: 2  (专用 + 有效期中等)
       * - 专用永久: 3  (专用 + 永久)
       * - 通用月度: 4  (通用 + 有效期最短)
       * - 通用年度: 5  (通用 + 有效期中等)
       * - 通用永久: 6  (通用 + 永久)
       */
      const getTokenPriority = (token: typeof allTokens[0]): number => {
        const isRestricted = restrictedTokens.includes(token);
        const typeScore = {
          [TokenType.MONTHLY]: 1,
          [TokenType.YEARLY]: 2,
          [TokenType.PERMANENT]: 3,
        }[token.type] || 3;

        // 专用代币优先级 = typeScore (1, 2, 3)
        // 通用代币优先级 = typeScore + 3 (4, 5, 6)
        return isRestricted ? typeScore : typeScore + 3;
      };

      // 合并所有可用代币并按优先级排序
      const allAvailableTokens = [...restrictedTokens, ...generalTokens]
        .filter(t => (t.amount - t.used) > 0)
        .sort((a, b) => getTokenPriority(a) - getTokenPriority(b));

      // 按优先级消耗代币
      for (const token of allAvailableTokens) {
        if (remainingToConsume <= 0) break;

        const available = token.amount - token.used;
        const toConsume = Math.min(available, remainingToConsume);

        if (toConsume > 0) {
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

          details.push({
            type: token.type,
            amount: toConsume,
          });

          remainingToConsume -= toConsume;
        }
      }

      // 3. 创建代币消耗记录
      const newTransactions = details.map((detail) => ({
        amount: detail.amount,
        tokenType: detail.type as any,
        userId,
        taskId,
        balanceSnapshot: {} as any, // 稍后更新
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
   * 发放代币（支持专用代币）
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
    /** 专用类型（可选，数组形式，用于限制代币只能用于特定任务） */
    restrictedType?: string[] | null;
  }) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      const { userId, type, amount, source, sourceId, description, restrictedType } = params;

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

      // 检查是否已有该类型的未过期代币（需要匹配 restrictedType）
      // 注意：Json 字段不能直接用字符串查询，需要在代码中过滤
      const allTokens = yield* Effect.tryPromise({
        try: () =>
          auth.db.token.findMany({
            where: {
              userId,
              type: type as any,
              active: true,
              ...(expiresAt ? { expiresAt: { gte: expiresAt } } : {}),
            },
          }),
        catch: (error) => {
          console.error('[TokenService] 查询现有代币失败:', error);
          throw MsgError.msg('查询代币失败');
        },
      });

      // 在代码中匹配 restrictedType
      const targetRestrictedType = restrictedType && restrictedType.length > 0
        ? JSON.stringify(restrictedType.sort())
        : '[]';

      const existing = allTokens.find((token) => {
        const tokenRestrictedType = token.restrictedType as string;
        return tokenRestrictedType === targetRestrictedType;
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
                restrictedType: restrictedType && restrictedType.length > 0 ? JSON.stringify(restrictedType.sort()) : '[]',
              },
            }),
          catch: (error) => {
            console.error('[TokenService] 创建代币失败:', error);
            console.error('[TokenService] 代币数据:', JSON.stringify({
              userId,
              type,
              amount,
              expiresAt,
              restrictedType,
            }, null, 2));
            throw MsgError.msg('创建代币失败');
          },
        });
      }
    }),

  /**
   * 获取用户代币列表（带分页）
   */
  getUserTokens: (userId: string, options?: {
    skip?: number;
    take?: number;
  }) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      const [tokens, total] = yield* Effect.all([
        Effect.tryPromise({
          try: () =>
            auth.db.token.findMany({
              where: { userId },
              orderBy: { created: 'desc' },
              skip: options?.skip || 0,
              take: options?.take || 20,
            }),
          catch: (error) => {
            console.error('[TokenService] 查询代币列表失败:', error);
            throw MsgError.msg('查询代币列表失败');
          },
        }),
        Effect.tryPromise({
          try: () =>
            auth.db.token.count({
              where: { userId },
            }),
          catch: (error) => {
            console.error('[TokenService] 查询代币总数失败:', error);
            return 0;
          },
        }),
      ]);

      return { tokens, total };
    }),

  /**
   * 获取用户代币使用历史（带分页）
   */
  getTokenHistory: (userId: string, options?: {
    skip?: number;
    take?: number;
    startDate?: Date;
    endDate?: Date;
  }) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;

      const [transactions, total] = yield* Effect.all([
        Effect.tryPromise({
          try: () =>
            auth.db.tokenTransaction.findMany({
              where: {
                userId,
                ...(options?.startDate && { created: { gte: options.startDate } }),
                ...(options?.endDate && { created: { lte: options.endDate } }),
              },
              orderBy: { created: 'desc' },
              skip: options?.skip || 0,
              take: options?.take || 20,
              include: {
                task: {
                  select: {
                    id: true,
                    title: true,
                    type: true,
                  },
                },
              },
            }),
          catch: (error) => {
            console.error('[TokenService] 查询代币历史失败:', error);
            throw MsgError.msg('查询代币历史失败');
          },
        }),
        Effect.tryPromise({
          try: () =>
            auth.db.tokenTransaction.count({
              where: {
                userId,
                ...(options?.startDate && { created: { gte: options.startDate } }),
                ...(options?.endDate && { created: { lte: options.endDate } }),
              },
            }),
          catch: (error) => {
            console.error('[TokenService] 查询代币历史总数失败:', error);
            return 0;
          },
        }),
      ]);

      return { transactions, total };
    }),
};
