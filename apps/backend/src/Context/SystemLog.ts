import { Effect } from 'effect';
import type { ReqCtx } from './ReqCtx';
import { DbClientEffect } from './DbService';
import { tryOrFail } from '../util/error';

/** 日志级别（与 schema.zmodel 的 LogLevel 枚举一致） */
type SystemLogLevel = 'info' | 'warn' | 'error';

/** console 保留原样：进程内实时观测（带 #reqId 前缀）与落库互不替代 */
export function systemLog(options: { level?: SystemLogLevel; message?: string }, ctx: ReqCtx) {
  const logFn = options.level === 'error' ? console.error : options.level === 'warn' ? console.warn : console.log;
  const logsSuffix = ctx.logs.length > 0 ? `\n${ctx.logs.map((el) => `  ${el}`).join('\n')}` : '';
  logFn(`#${ctx.reqId}| ${options.message ?? ''}${logsSuffix}`);
  return Effect.void;
}

/** 单条日志行的最大保留长度：防大 SQL/大 payload 把库撑爆 */
const LOG_LINE_MAX_CHARS = 500;
/** 单条请求日志的最大行数：超出截断保留头部（诊断价值集中在头部） */
const LOG_MAX_LINES = 200;

/** 截断后的日志行（超长行加 … 标记，行数超限时尾部加省略提示） */
function sanitizeLogs(logs: unknown[]): unknown[] {
  const clipped = logs.slice(0, LOG_MAX_LINES).map((line) => {
    const s = String(line);
    return s.length > LOG_LINE_MAX_CHARS ? s.slice(0, LOG_LINE_MAX_CHARS) + '…' : s;
  });
  if (logs.length > LOG_MAX_LINES) clipped.push(`…（共 ${logs.length} 行，已截断）`);
  return clipped;
}

/** 行为记录行：每请求一条，用户维度/时间维度查询的数据源（SystemLog 表） */
export interface BehaviorRow {
  level: SystemLogLevel;
  message: string;
  logs: unknown[];
  authUserId?: string;
  reqId: number;
  method: string;
  totalMs: number;
  error: boolean;
}

/**
 * 行为记录落盘（fire-and-forget：调用方 runFork + provide ConfigLive，不阻塞响应）。
 *
 * 与 DiagTrace 的分工：DiagTrace 只记慢请求（阈值触发）携带完整 timeline；
 * SystemLog 记全部请求的摘要 + 请求内日志行，供「用户在什么时间段触发了什么请求」
 * 的行为回溯，保留 7 天由 behaviorLogCleanupLoop 清理。
 */
export const insertBehaviorLog = (row: BehaviorRow) =>
  Effect.gen(function* () {
    const dbClient = yield* DbClientEffect;
    yield* tryOrFail('行为记录落盘', () =>
      dbClient.systemLog.create({
        data: {
          level: row.level.toUpperCase() as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
          message: row.message,
          logs: sanitizeLogs(row.logs) as never,
          authUserId: row.authUserId,
          reqId: row.reqId,
          method: row.method,
          totalMs: Math.round(row.totalMs),
          error: row.error,
        },
      }),
    );
  });
