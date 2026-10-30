import { Effect } from 'effect';
import { DbClientEffect } from '../../Context/DbService';
import { loopLagState } from '../../util/LoopLagMonitor';
import { fail } from '../../util/error';
import { dbTry } from '../../util/dbEffect';
import { requireAdmin } from '../../Context/Auth';

/** 诊断查询默认页大小 */
const DEFAULT_PAGE_SIZE = 20;
/** 诊断查询最大页大小（timeline JSON 较大，防一次拉爆） */
const MAX_PAGE_SIZE = 100;
/** 最远可回溯天数 */
const MAX_DAYS = 30;

/** 实时请求环形缓冲容量：只存最近 N 条（含快请求），新顶旧，零写库压力 */
const RECENT_CAPACITY = 500;

/** 实时请求记录：与 DiagTrace 行同构（id 为负数以区分落库记录），timeline 含 span 树 */
export interface RecentRequestRow {
  id: number;
  method: string;
  totalMs: number;
  queueWaitMs: number;
  authMs?: number;
  sqlCount: number;
  sqlTotalMs: number;
  sqlMaxMs: number;
  loopLagMaxMs: number;
  /** 卡顿归属：self=自身同步执行冻结了事件循环；other=排队期间被他人冻结（受害者）；undefined=无显著卡顿或旧版本记录 */
  lagOwner?: 'self' | 'other';
  error: boolean;
  timeline: Array<Record<string, unknown>>;
  created: string;
}

/** 内存环形缓冲：每请求结束后由 server/index.ts push，供 listRecent 查询 */
const recentRequests: RecentRequestRow[] = [];
let recentSeq = 0;

/** 推入一条实时请求观测记录（超容量丢弃最旧） */
export function pushRecentRequest(row: Omit<RecentRequestRow, 'id' | 'created'>): RecentRequestRow {
  const full: RecentRequestRow = { ...row, id: --recentSeq, created: new Date().toISOString() };
  recentRequests.unshift(full);
  if (recentRequests.length > RECENT_CAPACITY) recentRequests.length = RECENT_CAPACITY;
  return full;
}

/**
 * 分页查询慢请求诊断记录（时间倒序）。
 *
 * 阈值口径：totalMs>500 或 sqlMaxMs>100 或 loopLagMaxMs>50 的请求才会落盘，
 * 所以查出来的都是异常请求；正常请求不入库（零常态开销）。
 */
const listTraces = (opt: { page?: number; pageSize?: number; days?: number; minTotalMs?: number }) =>
  Effect.gen(function* () {
    yield* requireAdmin();
    const page = Math.max(1, opt.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, opt.pageSize ?? DEFAULT_PAGE_SIZE));
    const days = Math.min(MAX_DAYS, Math.max(1, opt.days ?? 7));
    const minTotalMs = Math.max(0, opt.minTotalMs ?? 0);
    const db = yield* DbClientEffect;
    const createdGte = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const where = { created: { gte: createdGte }, totalMs: { gte: minTotalMs } };
    const [items, total] = yield* Effect.all([
      dbTry('查询诊断记录', 'listTraces', () =>
        db.diagTrace.findMany({
          where,
          orderBy: { created: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ),
      dbTry('统计诊断总数', 'listTraces', () => db.diagTrace.count({ where })),
    ]);
    return { items, total, page, pageSize };
  });

/**
 * 单条诊断记录详情（含完整 timeline）
 */
const getTrace = (id: number) =>
  Effect.gen(function* () {
    yield* requireAdmin();
    if (!Number.isInteger(id) || id <= 0) return yield* fail('诊断记录 ID 无效');
    const db = yield* DbClientEffect;
    const trace = yield* dbTry('查询诊断详情', 'getTrace', () => db.diagTrace.findFirst({ where: { id } }));
    if (!trace) return yield* fail('诊断记录不存在');
    return trace;
  });

/**
 * 诊断总览：各慢因聚合 + 事件循环健康状态。
 *
 * sqlHeavy = sqlMaxMs 高但 lag 低（慢查询）；blockHeavy = lag 高（硬阻塞，
 * better-sqlite3 同步执行会冻结进程）；waitHeavy = 总耗时长但两者都低（外部 API/IO 等待）。
 */
const getOverview = () =>
  Effect.gen(function* () {
    yield* requireAdmin();
    const db = yield* DbClientEffect;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const traces = yield* dbTry('查询近 24h 诊断', 'getOverview', () =>
      db.diagTrace.findMany({
        where: { created: { gte: since } },
        orderBy: { created: 'desc' },
        take: 500,
        select: {
          id: true,
          method: true,
          totalMs: true,
          queueWaitMs: true,
          authMs: true,
          sqlCount: true,
          sqlTotalMs: true,
          sqlMaxMs: true,
          loopLagMaxMs: true,
          created: true,
        },
      }),
    );
    const total = traces.length;
    const sorted = [...traces].sort((a, b) => a.totalMs - b.totalMs);
    const p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)]! : null;
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)]! : null;
    const worst = sorted.at(-1) ?? null;
    const byType = {
      /** SQL 慢导致（sqlMaxMs>=100） */
      sqlHeavy: traces.filter((t) => t.sqlMaxMs >= 100).length,
      /** 硬阻塞（loopLagMaxMs>=50，同步代码冻结进程） */
      blockHeavy: traces.filter((t) => t.loopLagMaxMs >= 50).length,
      /** 事件等待（总耗时长但 SQL 与 lag 都不高，外部 API/IO） */
      waitHeavy: traces.filter((t) => t.totalMs >= 500 && t.sqlMaxMs < 100 && t.loopLagMaxMs < 50).length,
    };
    /** 方法维度聚合：找出最拖后腿的接口 */
    const methodMap = new Map<string, { count: number; totalMsSum: number; maxMs: number }>();
    for (const t of traces) {
      const cur = methodMap.get(t.method) ?? { count: 0, totalMsSum: 0, maxMs: 0 };
      cur.count++;
      cur.totalMsSum += t.totalMs;
      cur.maxMs = Math.max(cur.maxMs, t.totalMs);
      methodMap.set(t.method, cur);
    }
    const slowestMethods = [...methodMap.entries()]
      .map(([method, v]) => ({ method, count: v.count, avgMs: Math.round(v.totalMsSum / v.count), maxMs: v.maxMs }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 10);
    return {
      window: '近 24h',
      total,
      byType,
      p50: p50 && { method: p50.method, totalMs: p50.totalMs },
      p95: p95 && { method: p95.method, totalMs: p95.totalMs },
      worst: worst && { method: worst.method, totalMs: worst.totalMs, created: worst.created },
      slowestMethods,
      loopLag: {
        /** 最近 100 秒事件循环最大卡顿 ms，持续 >50 说明进程被频繁硬阻塞 */
        recentMaxLagMs: loopLagState.recentMaxLagMs,
        lastSampleAt: loopLagState.lastSampleAt,
      },
    };
  });

/** 查询实时请求观测：内存环形缓冲最近 N 条全量请求（含快请求），时间倒序 */
const listRecent = (opt: { limit?: number; minTotalMs?: number }) =>
  Effect.gen(function* () {
    yield* requireAdmin();
    const limit = Math.min(RECENT_CAPACITY, Math.max(1, opt.limit ?? 100));
    const minTotalMs = Math.max(0, opt.minTotalMs ?? 0);
    return { items: recentRequests.filter((r) => r.totalMs >= minTotalMs).slice(0, limit), capacity: RECENT_CAPACITY };
  });

/** API 慢请求诊断接口：查询慢请求追踪、阻塞类型判定、事件循环健康（全部要求管理员） */
export const diagApi = {
  /** 分页查询慢请求诊断记录 */
  listTraces,

  /** 单条诊断记录详情（含 timeline） */
  getTrace,

  /** 内存环形缓冲最近 N 条全量请求（含快请求） */
  listRecent,

  /** 诊断总览（近 24h 慢因聚合 + 最慢接口排行 + 事件循环健康） */
  getOverview,
};
