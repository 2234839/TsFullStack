import { Effect } from 'effect';
import { DbClientEffect } from '../Context/DbService';
import { ReqCtxService } from '../Context/ReqCtx';
import { dbTry, dbPaginatedFindMany } from '../util/dbEffect';
import { fail, requireOrFail, MsgError } from '../util/error';
import { TokenType, Token } from '../../.zenstack/models';
import { DEFAULT_PAGE_SIZE, MSG } from '../util/constants';

/** 代币默认来源 */
const DEFAULT_TOKEN_SOURCE = 'system';

/** 日志前缀 */
const LOG_PREFIX = '[TokenService]';

/** 优先级分数：无匹配类型的通用代币额外偏移 */
const GENERAL_TYPE_OFFSET = 3;

/** 永久代币过期偏移年数（远未来） */
const PERMANENT_TOKEN_YEARS_OFFSET = 100;

/** 月末/年末时间常量：23:59:59.999 */
const END_OF_DAY = { hour: 23, minute: 59, second: 59, ms: 999 } as const;

/** 分类后的代币 */
interface ClassifiedTokens {
  /** 专用代币（restrictedType 匹配任务类型） */
  specific: Token[];
  /** 通用代币（无 restrictedType 或为空数组） */
  general: Token[];
}

/** 代币类型优先级分数（越小越优先消耗） */
const TYPE_SCORE = {
  [TokenType.MONTHLY]: 1,
  [TokenType.YEARLY]: 2,
  [TokenType.PERMANENT]: 3,
} as const;

/** 未知代币类型的默认优先级分数（等同于 PERMANENT） */
const DEFAULT_TYPE_SCORE = TYPE_SCORE[TokenType.PERMANENT];

/** 计算指定类型代币的可用总额（amount - used 之和） */
function sumAvailableByType(tokens: Token[], type: TokenType): number {
  return tokens.filter(t => t.type === type).reduce((sum, t) => sum + (t.amount - t.used), 0);
}

/** 根据代币类型计算默认过期时间 */
function calcExpiresByType(type: TokenType): Date {
  const now = new Date();
  if (type === TokenType.MONTHLY) {
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, END_OF_DAY.hour, END_OF_DAY.minute, END_OF_DAY.second, END_OF_DAY.ms);
  }
  if (type === TokenType.YEARLY) {
    return new Date(now.getFullYear(), 11, 31, END_OF_DAY.hour, END_OF_DAY.minute, END_OF_DAY.second, END_OF_DAY.ms);
  }
  // PERMANENT 不过期，返回远未来日期
  return new Date(now.getFullYear() + PERMANENT_TOKEN_YEARS_OFFSET, 0);
}

/**
 * 将代币按是否匹配任务类型分类
 */
function classifyTokens(tokens: Token[], taskType: string): ClassifiedTokens {
  const specific: Token[] = [];
  const general: Token[] = [];

  for (const token of tokens) {
    let restricted: unknown = token.restrictedType ?? null;
    if (typeof restricted === 'string') {
      try {
        restricted = JSON.parse(restricted);
      } catch {
        /** 畸形 JSON 的受限代币不应被当作通用代币消耗，跳过 */
        continue;
      }
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
  /** 预计算优先级分数，避免排序比较时重复查表 */
  const allCandidates = [...specificTokens, ...generalTokens]
    .filter(t => (t.amount - t.used) > 0)
    .map(t => ({
      token: t,
      priority: (TYPE_SCORE[t.type] ?? DEFAULT_TYPE_SCORE) + (specificTokens.includes(t) ? 0 : GENERAL_TYPE_OFFSET),
    }));

  allCandidates.sort((a, b) => a.priority - b.priority);

  const updates: Array<{ id: number; newUsed: number }> = [];
  const details: Array<{ type: TokenType; amount: number }> = [];
  let remaining = amount;

  for (const { token } of allCandidates) {
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

/** 查询用户的活跃代币（模块内部辅助函数） */
const findActiveTokens = (userId: string, tokenType?: TokenType) =>
  Effect.flatMap(DbClientEffect, (db) =>
    dbTry(LOG_PREFIX, '查询代币', () =>
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
    ),
  );

export const TokenService = {

  /**
   * 获取用户可用代币总额
   */
  getAvailableTokens: (userId: string) =>
    Effect.gen(function* () {
      const tokens = yield* findActiveTokens(userId);
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
        findActiveTokens(userId),
      ]);

      const task = yield* requireOrFail(taskRaw, MSG.TASK_NOT_FOUND);

      // 1. 分类代币（专用 vs 通用）并检查余额
      const { specific: specificTokens, general: generalTokens } = classifyTokens(allTokens, task.type);

      const totalAvailable = [...specificTokens, ...generalTokens]
        .reduce((sum, t) => sum + Math.max(0, t.amount - t.used), 0);

      reqCtx.log(`${LOG_PREFIX} 任务类型: ${task.type}, 需要代币: ${amount}, 总可用: ${totalAvailable}`);

      if (totalAvailable < amount) {
        return yield* fail(`${MSG.TOKEN_INSUFFICIENT}！需要 ${amount} 枚，但只有 ${totalAvailable} 枚可用`);
      }

      // 2. 计算消耗计划并持久化
      const { updates, details } = calculateConsumptionPlan(generalTokens, specificTokens, amount);

      /** 消耗前余额快照（用于审计） */
      const balanceSnapshot = calculateBalanceSnapshot(generalTokens, specificTokens);

      /** 代币扣减 + 消耗记录写入在同一事务中，保证原子性（扣减成功则必有审计记录） */
      /** 构建代币 ID → Token 的索引，避免事务内每次迭代合并数组 + find */
      const tokenById = new Map([...specificTokens, ...generalTokens].map(t => [t.id, t]));

      yield* dbTry(LOG_PREFIX, '代币扣减与消耗记录', () =>
        db.$transaction(async (tx) => {
          for (const u of updates) {
            /** 乐观锁：在事务内重新读取当前 used 值，防止并发超支 */
            const current = await tx.token.findUnique({ where: { id: u.id }, select: { used: true, amount: true } });
            if (!current) throw MsgError.msg(`代币记录不存在: ${u.id}`);
            const token = tokenById.get(u.id);
            const expectedIncrement = token ? u.newUsed - token.used : 0;
            /** 并发场景下 used 可能已被其他请求增加，按实际增量而非快照增量执行 */
            const actualIncrement = Math.min(expectedIncrement, current.amount - current.used);
            if (actualIncrement <= 0) throw MsgError.msg(MSG.TOKEN_INSUFFICIENT);
            await tx.token.update({ where: { id: u.id }, data: { used: { increment: actualIncrement } } });
          }
          await tx.tokenTransaction.createMany({
            data: details.map(d => ({
              amount: d.amount,
              tokenType: d.type,
              userId,
              taskId,
              balanceSnapshot,
              note: `任务 ${taskId} 消耗 ${d.amount} ${d.type} 代币`,
            })),
          });
        }),
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
      const sortedRestricted = restrictedType && restrictedType.length > 0
        ? [...restrictedType].sort()
        : [];
      const targetRestrictedType = sortedRestricted.length > 0
        ? JSON.stringify(sortedRestricted)
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
            const tokenRestricted = token.restrictedType
              ? JSON.stringify(
                  Array.isArray(token.restrictedType)
                    ? [...token.restrictedType].sort()
                    : token.restrictedType
                )
              : '[]';
            return tokenRestricted === targetRestrictedType;
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
    Effect.flatMap(DbClientEffect, (db) =>
      dbPaginatedFindMany(LOG_PREFIX,
        () => db.token.findMany({
          where: { userId },
          orderBy: { created: 'desc' },
          skip: options?.skip ?? 0,
          take: options?.take ?? DEFAULT_PAGE_SIZE,
        }),
        () => db.token.count({ where: { userId } }),
      ),
    ),

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
        ...(options?.startDate || options?.endDate ? {
          created: {
            ...(options?.startDate && { gte: options.startDate }),
            ...(options?.endDate && { lte: options.endDate }),
          },
        } : {}),
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
