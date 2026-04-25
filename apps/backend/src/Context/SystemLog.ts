import { Effect } from 'effect';
import type { ReqCtx } from './ReqCtx';

/** 日志级别 */
type SystemLogLevel = 'info' | 'warn' | 'error';

export function systemLog(options: { level?: SystemLogLevel; message?: string }, ctx: ReqCtx) {
  const logFn = options.level === 'error' ? console.error : options.level === 'warn' ? console.warn : console.log;
  const logsSuffix = ctx.logs.length > 0
    ? `\n${ctx.logs.map(el => `  ${el}`).join('\n')}`
    : '';
  logFn(`#${ctx.reqId}| ${options.message ?? ''}${logsSuffix}`);
  return Effect.void;
}
