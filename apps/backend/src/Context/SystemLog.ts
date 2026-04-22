import { LogLevel } from '../../.zenstack/models';
import { Effect } from 'effect';
import type { ReqCtx } from './ReqCtx';

export function systemLog(options: { level: LogLevel; message?: string }, ctx: ReqCtx) {
  return Effect.gen(function* () {
    console.log(
      `#${ctx.reqId}| ${options.message}${ctx.logs.length > 0 ? '\n' + ctx.logs.map((el) => '  ' + el).join('\n') : ''}`,
    );
  });
}
