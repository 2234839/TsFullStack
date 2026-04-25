import { Effect } from 'effect';
import { DbClientEffect } from '../Context/DbService';
import { ReqCtxService } from '../Context/ReqCtx';
import { dbTry, dbPaginatedFindMany } from '../util/dbEffect';
import { fail, requireOrFail } from '../util/error';
import { TokenType, Token } from '../../.zenstack/models';
import { DEFAULT_PAGE_SIZE, MSG } from '../util/constants';

/** 代币默认来源 */
const DEFAULT_TOKEN_SOURCE = 'system';

/** 日志前缀 */
const LOG_PREFIX = '[TokenService]';

/** 分类后的代币 */
interface ClassifiedTokens {
  /** 专用代币（restrictedType 匹配任务类型） */
  specific: Token[];
  /** 通用代币（无 restrictedType 或为空数组） */
  general: Token[];
}

/** 代币类型优先级分数（越小越优先消耗） */
const TYPE_SCORE: Record<TokenType, number> = {
  [TokenType.MONTHLY]: 1,
  [TokenType.YEARLY]: 2,
  [TokenType.PERMANENT]: 3,
};

/** 计算指定类型代币的可用总额（amount - used 之和） */
function sumAvailableByType(tokens: Token[], type: TokenType): number {
  return tokens.filter(t => t.type === type).reduce((sum, t) => sum + (t.amount - t.used), 0);
}

/** 根据代币类型计算默认过期时间 */
function calcExpiresByType(type: TokenType): Date {
  const now = new Date();
  if (type === TokenType.MONTHLY) {
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  if (type === TokenType.YEARLY) {
    return new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  }
  // PERMANENT 不过期，返回远未来日期
  return new Date(now.getFullYear() + 100, 0);
}

/**
 * 将代币按是否匹配任务类型分类
 */
function classifyTokens(tokens: Token[], taskType: string): ClassifiedTokens {
  const specific: Token[] = [];
  const general: Token[] = [];

  for (const token of tokens) {
    let restricted: unknown;
    try {
      restricted = token.restrictedType ? JSON.parse(String(token.restrictedType)) : null;
    } catch {
      restricted = null;
    }

    const isEmpty = !restricted || (Array.isArray(restricted) && restricted.length === 0);
    const matchesTask = !isEmpty && (
      (Array.isArray(restricted) && (restricted as unknown[]).includes(taskType)) ||
      restricted === taskType
    );

    if (!isEmpty && matchesTask) {
      specific.push(token);
    } else if (isEmpty) {
      general.push(token);
    }
  }

  return { specific, general };
}

/**
 * 计算代币消耗计划：按优先级排序后逐个扣减，返回更新列表和消耗明细
 */
function calculateConsumptionPlan(
  generalTokens: Token[],
  specificTokens: Token[],
  amount: number,
): { updates: Array<{ id: number; newUsed: number }>; details: Array<{ type: TokenType; amount: number }> } {
  const specificSet = new Set(specificTokens.map(t => t.id));

  const getTokenPriority = (token: Token): number => {
    const isSpecific = specificSet.has(token.id);
    const typeScore = TYPE_SCORE[token.type] ?? 3;
    return isSpecific ? typeScore : typeScore + 3;
  };

  const sorted = [...specificTokens, ...generalTokens]
    .filter(t => (t.amount - t.used) > 0)
    .sort((a, b) => getTokenPriority(a) - getTokenPriority(b));

  const updates: Array<{ id: number; newUsed: number }> = [];
  const details: Array<{ type: TokenType; amount: number }> = [];
  let remaining = amount;

  for (const token of sorted) {
    if (remaining <= 0) break;

    const available = token.amount - token.used;
    const toConsume = Math.min(available, remaining);

    if (toConsume > 0) {
      updates.push({ id: token.id, newUsed: token.used + toConsume });
      details.push({ type: token.type, amount: toConsume });
      remaining -= toConsume;
    }
  }

  return { updates, details };
}

/** 合并两组代币后计算指定类型的可用总额 */
function sumBothByType(generalTokens: Token[], specificTokens: Token[], type: TokenType): number {
  return sumAvailableByType(generalTokens, type) + sumAvailableByType(specificTokens, type);
}

/**
 * 计算消耗前各类型代币余额快照（用于审计记录）
 */
function calculateBalanceSnapshot(
  generalTokens: Token[],
  specificTokens: Token[],
): { monthly: number; yearly: number; permanent: number } {
  return {
    monthly: sumBothByType(generalTokens, specificTokens, TokenType.MONTHLY),
    yearly: sumBothByType(generalTokens, specificTokens, TokenType.YEARLY),
    permanent: sumBothByType(generalTokens, specificTokens, TokenType.PERMANENT),
  };
}

/**
 * 基于原始代币数据和已消耗明细计算剩余额度（避免额外 DB 查询）
 */
function calculateRemaining(
  generalTokens: Token[],
  specificTokens: Token[],
  details: Array<{ type: TokenType; amount: number }>,
): { monthly: number; yearly: number; permanent: number } {
  const consumedByType: Record<string, number> = {};
  for (const d of details) {
    consumedByType[d.type] = (consumedByType[d.type] ?? 0) + d.amount;
  }

  return {
    monthly: Math.max(0, sumBothByType(generalTokens, specificTokens, TokenType.MONTHLY) - (consumedByType[TokenType.MONTHLY] ?? 0)),
    yearly: Math.max(0, sumBothByType(generalTokens, specificTokens, TokenType.YEARLY) - (consumedByType[TokenType.YEARLY] ?? 0)),
    permanent: Math.max(0, sumBothByType(generalTokens, specificTokens, TokenType.PERMANENT) - (consumedByType[TokenType.PERMANENT] ?? 0)),
  };
}

/**
 * 代币服务
 *
 * 注意：本服务所有方法仅依赖 DbClientEffect（数据库客户端），
 * 不依赖 AuthContext（用户身份），因为 userId 均通过参数传入。
 * 权限控制由调用方（API 层）负责。
 */
export const TokenService = {
  /**
   * 查询用户的活跃代币（内部辅助函数）
   */
  findActiveTokens: (userId: string, tokenType?: TokenType) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;
      return yield* dbTry(LOG_PREFIX, '查询代币', () =>
        db.token.findMany({
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
      );
    }),

  /**
   * 获取用户可用代币总额
   */
  getAvailableTokens: (userId: string) =>
    Effect.gen(function* () {
      const tokens = yield* TokenService.findActiveTokens(userId);
      const monthly = sumAvailableByType(tokens, TokenType.MONTHLY);
      const yearly = sumAvailableByType(tokens, TokenType.YEARLY);
      const permanent = sumAvailableByType(tokens, TokenType.PERMANENT);
      return { monthly, yearly, permanent, total: monthly + yearly + permanent };
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
  consumeTokens: (userId: string, amount: number, taskId: number) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;
      const reqCtx = yield* ReqCtxService;

      // 0. 并行查询任务类型和用户代币（两者无数据依赖）
      const [taskRaw, allTokens] = yield* Effect.all([
        dbTry(LOG_PREFIX, '查询任务', () =>
          db.task.findUnique({ where: { id: taskId }, select: { type: true } }),
        ),
        TokenService.findActiveTokens(userId),
      ]);

      const task = yield* requireOrFail(taskRaw, MSG.TASK_NOT_FOUND);

      // 1. 分类代币（专用 vs 通用）并检查余额
      const { specific: specificTokens, general: generalTokens } = classifyTokens(allTokens, task.type);

      const totalAvailable = [...specificTokens, ...generalTokens]
        .reduce((sum, t) => sum + t.amount - t.used, 0);

      reqCtx.log(`${LOG_PREFIX} 任务类型: ${task.type}, 需要代币: ${amount}, 总可用: ${totalAvailable}`);

      if (totalAvailable < amount) {
        return yield* fail(`${MSG.TOKEN_INSUFFICIENT}！需要 ${amount} 枚，但只有 ${totalAvailable} 枚可用`);
      }

      // 2. 计算消耗计划并持久化
      const { updates, details } = calculateConsumptionPlan(generalTokens, specificTokens, amount);

      /** 消耗前余额快照（用于审计） */
      const balanceSnapshot = calculateBalanceSnapshot(generalTokens, specificTokens);

      /** 代币扣减 + 消耗记录写入在同一事务中，保证原子性（扣减成功则必有审计记录） */
      yield* dbTry(LOG_PREFIX, '代币扣减与消耗记录', () =>
        db.$transaction([
          ...updates.map(u => db.token.update({ where: { id: u.id }, data: { used: u.newUsed } })),
          db.tokenTransaction.createMany({
            data: details.map(d => ({
              amount: d.amount,
              tokenType: d.type,
              userId,
              taskId,
              balanceSnapshot,
              note: `任务 ${taskId} 消耗 ${d.amount} ${d.type} 代币`,
            })),
          }),
        ]),
      );

      // 4. 计算剩余额度（基于内存数据，无额外 DB 查询）
      const remaining = calculateRemaining(generalTokens, specificTokens, details);

      return { details, total: amount, remaining };
    }),

  /**
   * 发放代币（支持专用代币）
   */
  grantTokens: (params: {
    /** 用户ID */
    userId: string;
    /** 代币类型 */
    type: TokenType;
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
      const db = yield* DbClientEffect;
      const reqCtx = yield* ReqCtxService;

      const { userId, type, amount, source, sourceId, description, restrictedType } = params;

      /** 代币数量必须为正有限数 */
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        return yield* fail(MSG.TOKEN_AMOUNT_POSITIVE);
      }

      /** restrictedType 必须是扁平字符串数组或 null（防止嵌套结构导致消耗匹配失败） */
      if (restrictedType !== null && (!Array.isArray(restrictedType) || restrictedType.some((t) => typeof t !== 'string'))) {
        return yield* fail(MSG.RESTRICTED_TYPE_INVALID);
      }

      // 计算过期时间（未指定时按类型自动计算）
      let expiresAt: Date | undefined = params.expiresAt;
      if (!expiresAt) {
        expiresAt = calcExpiresByType(type);
      }

      // 检查是否已有该类型的未过期代币（需要匹配 restrictedType）
      // 使用事务保证查询+写入的原子性，防止并发重复创建
      const targetRestrictedType = restrictedType && restrictedType.length > 0
        ? JSON.stringify(restrictedType.sort())
        : '[]';

      yield* dbTry(LOG_PREFIX, '发放代币', () =>
        db.$transaction(async (tx) => {
          const allTokens = await tx.token.findMany({
            where: {
              userId,
              type,
              active: true,
              ...(expiresAt ? { expiresAt: { gte: expiresAt } } : {}),
            },
          });

          const existing = allTokens.find((token) => {
            return JSON.stringify(token.restrictedType) === JSON.stringify(targetRestrictedType);
          });

          if (existing) {
            return tx.token.update({
              where: { id: existing.id },
              data: { amount: existing.amount + amount },
            });
          }

          return tx.token.create({
            data: {
              userId,
              type,
              amount,
              used: 0,
              expiresAt,
              source: source ?? DEFAULT_TOKEN_SOURCE,
              sourceId,
              description,
              restrictedType: targetRestrictedType,
            },
          });
        }),
      );

      reqCtx.log(`${LOG_PREFIX} 发放代币: userId=${userId}, amount=${amount}, type=${type}`);
    }),

  /**
   * 获取用户代币列表（带分页）
   */
  getUserTokens: (userId: string, options?: {
    skip?: number;
    take?: number;
  }) =>
    Effect.gen(function* () {
      const db = yield* DbClientEffect;
      return yield* dbPaginatedFindMany(LOG_PREFIX,
        () => db.token.findMany({
          where: { userId },
          orderBy: { created: 'desc' },
          skip: options?.skip ?? 0,
          take: options?.take ?? DEFAULT_PAGE_SIZE,
        }),
        () => db.token.count({ where: { userId } }),
      );
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
      const db = yield* DbClientEffect;
      const where = {
        userId,
        ...(options?.startDate && { created: { gte: options.startDate } }),
        ...(options?.endDate && { created: { lte: options.endDate } }),
      };
      const { items, total } = yield* dbPaginatedFindMany(LOG_PREFIX,
        () => db.tokenTransaction.findMany({
          where,
          orderBy: { created: 'desc' },
          skip: options?.skip ?? 0,
          take: options?.take ?? DEFAULT_PAGE_SIZE,
          include: { task: { select: { id: true, title: true, type: true } } },
        }),
        () => db.tokenTransaction.count({ where }),
      );
      return { transactions: items, total };
    }),
};
