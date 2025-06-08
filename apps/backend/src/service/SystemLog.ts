import { LogLevel } from '@zenstackhq/runtime/models';
import { prisma } from '../db';
import type { ReqCtx } from './ReqCtx';

// export class SystemLogService extends Context.Tag('SystemLogService')<
//   SystemLogService,
//   typeof systemLog
// >() {}

export async function systemLog(options: { level: LogLevel; message?: string }, ctx: ReqCtx) {
  const log = await prisma.systemLog.create({
    data: {
      level: options.level,
      logs: ctx.logs,
      authUserId: ctx.user?.id,
      message: options.message,
    },
    select: {
      id: true,
    },
  });
  console.log(`[log:${log.id}] ${options.message}`, ...ctx.logs);
  return log;
}
