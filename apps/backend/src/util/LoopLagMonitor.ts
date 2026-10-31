import { Effect, Fiber, Ref, Schedule } from 'effect';

/**
 * 事件循环卡顿监控器。
 *
 * 原理：以固定间隔采样，记录「本 tick 预期唤醒时刻」与「实际唤醒时刻」的差值。
 * 差值大 = 两次采样之间事件循环被同步代码冻结过（硬阻塞，如 better-sqlite3 慢查询、
 * 大 JSON 序列化）；差值≈0 说明循环一直健康，请求慢是纯事件等待（等外部 API/IO）。
 *
 * 用 Effect.repeat + Fiber 而非裸 setInterval，遵守后端 Effect v4 定时任务规范。
 */

/** 单次卡顿采样 */
type LagSample = {
  /** 采样窗口起点 ms（performance.now 时基） */
  at: number;
  /** 本次间隔的事件循环卡顿 ms（实际唤醒 - 预期唤醒 - 0；≥0） */
  lagMs: number;
};

/** 采样间隔 ms。过小会放大调度噪声，过大漏检短阻塞；25ms 实测平衡 */
const SAMPLE_INTERVAL_MS = 25;

/** 环形缓冲容量：25ms × 4000 = 覆盖最近 100 秒样本 */
const RING_CAPACITY = 4000;

/** 全局样本环形缓冲 */
const samples: LagSample[] = [];

/** 单飞标志：防止重复启动多个监控 Fiber */
let started = false;

/** 已启动的 Fiber（优雅关闭用） */
let fiber: Fiber.Fiber<void, never> | null = null;

/**
 * 事件循环健康状态：最近一次采样到的最大卡顿（供外部轮询展示）
 */
export const loopLagState = {
  /** 最近 100 秒窗口内的最大卡顿 ms */
  recentMaxLagMs: 0,
  /** 最近一次采样时刻 */
  lastSampleAt: 0,
};

/**
 * 记录一次采样（环形缓冲 + 状态聚合）
 */
function pushSample(sample: LagSample) {
  samples.push(sample);
  if (samples.length > RING_CAPACITY) samples.shift();
  loopLagState.lastSampleAt = sample.at + sample.lagMs;
  // recentMax 用滑动窗口近似：重算近期窗口最大值（容量 4000，重算开销可忽略）
  const windowStart = sample.at - RING_CAPACITY * SAMPLE_INTERVAL_MS;
  let max = 0;
  for (let i = samples.length - 1; i >= 0; i--) {
    const s = samples[i]!;
    if (s.at < windowStart) break;
    if (s.lagMs > max) max = s.lagMs;
  }
  loopLagState.recentMaxLagMs = max;
}

/**
 * 启动事件循环卡顿监控 Fiber（进程级单例，重复调用为空操作）
 */
export function startLoopLagMonitor() {
  if (started) return;
  started = true;
  const program = Effect.gen(function* () {
    const lastRef = yield* Ref.make({ expectedAt: 0 });
    yield* Effect.repeat(
      Effect.gen(function* () {
        const now = performance.now();
        const last = yield* Ref.get(lastRef);
        if (last.expectedAt > 0) {
          /** 卡顿 = 实际唤醒时刻与预期唤醒时刻之差（首个 tick 无基准跳过） */
          const lag = Math.max(0, Math.round(now - last.expectedAt));
          pushSample({ at: last.expectedAt, lagMs: lag });
        }
        yield* Ref.set(lastRef, { expectedAt: now + SAMPLE_INTERVAL_MS });
      }),
      Schedule.spaced(`${SAMPLE_INTERVAL_MS} millis`),
    );
    yield* Effect.never;
  });
  fiber = Effect.runFork(program);
}

/**
 * 停止监控 Fiber（优雅关闭用）
 */
export function stopLoopLagMonitor() {
  if (fiber) {
    fiber.interruptUnsafe();
    fiber = null;
    started = false;
  }
}

/** 单条卡顿样本（导出给诊断时间线叠加展示） */
export type LagSlice = { at: number; lagMs: number };

/**
 * 取 [startMs, endMs] 时间窗内的卡顿样本（时基与 performance.now 一致），
 * 供诊断时间线在瀑布图上叠加展示「哪些时段事件循环被冻结」。
 */
export function lagSamplesBetween(startMs: number, endMs: number): LagSlice[] {
  const out: LagSlice[] = [];
  for (const s of samples) {
    if (s.at > endMs) break;
    /** 只按真实冻结区间 [s.at, s.at+lagMs] 判交集；不得用采样间隔扩窗，
     * 否则请求开始前的冻结会被硬蹭进本请求窗口，画出「第 -10ms 起冻结」的错位条 */
    if (s.lagMs > 0 && s.at < endMs && s.at + s.lagMs > startMs) {
      out.push({ at: s.at, lagMs: s.lagMs });
    }
  }
  return out;
}

/**
 * 取 [startMs, endMs] 时间窗内的最大卡顿 ms（时基与 performance.now 一致）
 *
 * 用于请求结束时回答「这个请求期间事件循环被硬阻塞了多久」。
 * 采样粒度 25ms，结果向上近似（宁可信其有阻塞）。
 */
export function maxLoopLagBetween(startMs: number, endMs: number): number {
  let max = 0;
  for (const s of samples) {
    if (s.at > endMs) break;
    /** 只按真实冻结区间 [s.at, s.at+lagMs] 判交集，与 lagSamplesBetween 同口径 */
    if (s.lagMs > 0 && s.at < endMs && s.at + s.lagMs > startMs && s.lagMs > max) {
      max = s.lagMs;
    }
  }
  return max;
}
