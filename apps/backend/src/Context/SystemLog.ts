import { LogLevel } from '../../.zenstack/models';
import { Effect } from 'effect';
import { DbService } from './DbService';
import type { ReqCtx } from './ReqCtx';
import type { JsonObject } from '@zenstackhq/orm';

export function systemLog(options: { level: LogLevel; message?: string }, ctx: ReqCtx) {
  return Effect.gen(function* () {
    const { dbClient } = yield* DbService;
    const log = yield* Effect.promise(() =>
      dbClient.systemLog.create({
        data: {
          level: options.level,
          logs: ctx.logs as unknown as JsonObject, // JsonValue 类型
          authUserId: ctx.user?.id,
          message: options.message,
        },
        select: {
          id: true,
        },
      }).catch(e => {
        return {id:'create error'}
      })
    );
    console.log(`[log:${log.id}] ${options.message}`, ctx.logs.join('\n'));
    return log;
  });
}
