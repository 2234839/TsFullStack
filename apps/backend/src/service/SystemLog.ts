import { LogLevel } from '@zenstackhq/runtime/models';
import { Effect } from 'effect';
import { PrismaService } from './PrismaService';
import type { ReqCtx } from './ReqCtx';

export function systemLog(options: { level: LogLevel; message?: string }, ctx: ReqCtx) {
  return Effect.gen(function* () {
    const { prisma } = yield* PrismaService;
    const log = yield* Effect.promise(() =>
      prisma.systemLog.create({
        data: {
          level: options.level,
          logs: ctx.logs,
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
