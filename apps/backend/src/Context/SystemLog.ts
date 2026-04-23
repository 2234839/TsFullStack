import { Effect } from 'effect';
import type { ReqCtx } from './ReqCtx';

/** 日志级别 */
export type SystemLogLevel = 'info' | 'warn' | 'error';

export function systemLog(options: { level?: SystemLogLevel; message?: string }, ctx: ReqCtx) {
  return Effect.gen(function* () {
    const logFn = options.level === 'error' ? console.error : options.level === 'warn' ? console.warn : console.log;
    logFn(
      `#${ctx.reqId}| ${options.message ?? ''}${ctx.logs.length > 0 ? '\n' + ctx.logs.map((el) => '  ' + el).join('\n') : ''}`,
    );
  });
}
