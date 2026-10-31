import { Duration, Effect, Fiber, Schedule } from 'effect';
import fs from 'fs/promises';
import { AppLive } from './Context/AppLive';
import { AppConfigService } from './Context/AppConfig';
import { PaymentConfigService } from './Context/PaymentConfig';
import { DbClientEffect } from './Context/DbService';
import { seedDB } from './db/seed';
import { startServer } from './server';
import { PrismaQueue } from './util/dbQueue';
import { TokenGrantService } from './services/TokenGrantService';
import { TokenCleanupService } from './services/TokenCleanupService';
import { OrderReconciliationService, queryOrderStatus } from './services/payment/OrderReconciliationService';
import { extractErrorMessage, fail, tryOrFail } from './util/error';
import {
  MS_PER_HOUR,
  MEMORY_LOG_INTERVAL_MS,
  QUEUE_STARTUP_DELAY_MS,
  RECONCILE_STARTUP_DELAY_MS,
  QUEUE_NAME_GRANT_TOKENS,
} from './util/constants';
import { PaymentProvider } from '../.zenstack/models';

/** 日志前缀 */
const LOG_PREFIX_TOKEN_GRANT = '[TokenGrant]';
const LOG_PREFIX_TOKEN_CLEANUP = '[TokenCleanup]';
const LOG_PREFIX_RECONCILE = '[OrderReconciliation]';
const LOG_PREFIX_FATAL = '[Fatal]';
const LOG_PREFIX_SHUTDOWN = '[Shutdown]';

/** 队列引用，用于优雅关闭时停止 */
let shutdownQueue: PrismaQueue<Record<string, { payload: unknown; result: unknown }>> | null = null;

const main = Effect.gen(function* () {
  const config = yield* AppConfigService;

  /** 确保上传文件夹的路径存在 */
  const dirExists = yield* tryOrFail('检查上传目录', async () => {
    try {
      return await fs.stat(config.uploadDir);
    } catch {
      return null;
    }
  });
  if (!dirExists) {
    yield* tryOrFail('创建上传目录', () => fs.mkdir(config.uploadDir, { recursive: true }));
    console.log(`Upload directory ${config.uploadDir} is ready`);
  } else if (!dirExists.isDirectory()) {
    return yield* fail(`Upload directory ${config.uploadDir} is not a directory`);
  }

  yield* seedDB;

  /** 启动代币发放队列 */
  const dbClient = yield* DbClientEffect;

  type QueueTasks = {
    [QUEUE_NAME_GRANT_TOKENS]: {
      payload: { subscriptionId: number; userId: string };
      result: {
        success: boolean;
        skipped?: boolean;
        reason?: string;
        userId?: string;
        packageName?: string;
        amount?: number;
        nextGrantDate?: Date;
      };
    };
  };

  const tokenQueue = new PrismaQueue<QueueTasks>({ dbClient });
  shutdownQueue = tokenQueue;

  // 注册代币发放任务处理器（委托给 TokenGrantService）
  tokenQueue.register(QUEUE_NAME_GRANT_TOKENS, async (payload) => {
    const result = await TokenGrantService.processSubscriptionGrant(payload, dbClient);

    if (result.success) {
      console.log(
        `${LOG_PREFIX_TOKEN_GRANT} 用户 ${result.userId} 的订阅 ${result.packageName} 自动发放 ${result.amount} 代币，下次发放时间: ${result.nextGrantDate?.toISOString()}`,
      );
    } else {
      console.log(`${LOG_PREFIX_TOKEN_GRANT} ${result.reason}，跳过发放`);
    }

    return result;
  });

  // 启动队列
  tokenQueue.start();
  console.log(`${LOG_PREFIX_TOKEN_GRANT} 代币发放队列已启动`);

  // 启动服务器（阻塞至进程退出）
  yield* startServer;
});

// ===== 定时任务：全部 Fiber 化，由 Fiber.interruptAll 统一回收，不再手工管理 setInterval 句柄 =====

/** 定时任务 Fiber 集合，优雅关闭时统一中断 */
const loopFibers: Fiber.Fiber<unknown, unknown>[] = [];

/** 内存波动日志（单次执行体：仅在数值变化时输出） */
const memoryLogOnce = Effect.sync(() => {
  let lastUsage = { rssMB: 0, heapTotalMB: 0 };
  let lastTime = Date.now();
  return () => {
    const usage = process.memoryUsage();
    const currentTime = Date.now();

    const rssMB = Math.round(usage.rss / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);

    if (rssMB !== lastUsage.rssMB || heapTotalMB !== lastUsage.heapTotalMB) {
      /** 格式化数值变化为 ↑/↓/→ 字符串 */
      const formatChange = (current: number, previous: number): string => {
        const diff = current - previous;
        return diff > 0 ? `↑${diff}` : diff < 0 ? `↓${Math.abs(diff)}` : '→0';
      };
      const rssChange = formatChange(rssMB, lastUsage.rssMB);
      const heapChange = formatChange(heapTotalMB, lastUsage.heapTotalMB);

      console.log(
        `内存波动: 常驻内存 ${rssMB} MB  堆总大小 ${heapTotalMB} MB ` +
          `[常驻内存变化: ${rssChange} MB, 堆总大小变化: ${heapChange} MB, 时间间隔: ${currentTime - lastTime} ms]`,
      );
    }

    lastUsage = { rssMB, heapTotalMB };
    lastTime = currentTime;
  };
});

/** 内存日志循环：首次立即执行，之后按固定间隔 */
const memoryLogLoop = Effect.map(memoryLogOnce, (log) => log()).pipe(
  Effect.repeat(Schedule.spaced(MEMORY_LOG_INTERVAL_MS)),
);

/** 过期代币清理循环：延迟启动 + 每小时一次 */
const tokenCleanupLoop = Effect.gen(function* () {
  yield* Effect.sleep(Duration.millis(QUEUE_STARTUP_DELAY_MS));
  const dbClient = yield* DbClientEffect;
  const totalDeleted = yield* TokenCleanupService.cleanupExpiredTokens(dbClient);
  if (totalDeleted > 0) {
    console.log(`${LOG_PREFIX_TOKEN_CLEANUP} 清理完成：删除了 ${totalDeleted} 条过期代币记录`);
  }
}).pipe(
  Effect.catch((error) => Effect.sync(() => console.error(`${LOG_PREFIX_TOKEN_CLEANUP} 清理任务失败:`, error))),
  Effect.repeat(Schedule.spaced(MS_PER_HOUR)),
);

/** 行为记录保留天数：网络安全法第 21 条要求网络日志留存不少于六个月，
 * 同时个保法要求个人信息保存期限最短必要——収在 183 天（首次启动即清理超期记录） */
const BEHAVIOR_LOG_RETENTION_DAYS = 183;
/** 行为记录清理间隔：每天一次 */
const BEHAVIOR_LOG_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** 行为记录清理循环：每天删除保留期外的 SystemLog（每请求一条，不清理会无限增长） */
const behaviorLogCleanupLoop = Effect.gen(function* () {
  const dbClient = yield* DbClientEffect;
  const cutoff = new Date(Date.now() - BEHAVIOR_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const deleted = yield* tryOrFail('清理过期行为记录', () =>
    dbClient.systemLog.deleteMany({ where: { created: { lt: cutoff } } }),
  );
  if (deleted.count > 0) {
    console.log(`[BehaviorLogCleanup] 已删除 ${deleted.count} 条过期行为记录（>${BEHAVIOR_LOG_RETENTION_DAYS}天）`);
  }
}).pipe(
  Effect.catch((error) => Effect.sync(() => console.error('[BehaviorLogCleanup] 清理任务失败:', error))),
  Effect.repeat(Schedule.spaced(BEHAVIOR_LOG_CLEANUP_INTERVAL_MS)),
);

/** 支付订单对账循环：延迟启动，仅有待处理订单时才执行实际查询 */
const reconcileLoop = Effect.gen(function* () {
  yield* Effect.sleep(Duration.millis(RECONCILE_STARTUP_DELAY_MS));
  const dbClient = yield* DbClientEffect;
  const paymentConfig = yield* PaymentConfigService;

  const intervalMs = OrderReconciliationService.getReconcileIntervalMs();
  const isDev = process.env.NODE_ENV !== 'production';
  console.log(
    `${LOG_PREFIX_RECONCILE} 对账任务已启动 (间隔${isDev ? `${intervalMs / 1000}s` : `${intervalMs / 60000}min`}, ${isDev ? '开发模式' : '生产模式'})`,
  );

  /** 订单状态查询：由本处 provide PaymentConfigService，服务层保持无状态 */
  const query = (provider: PaymentProvider, orderNo: string) =>
    Effect.runPromise(
      queryOrderStatus(provider, orderNo).pipe(Effect.provideService(PaymentConfigService, paymentConfig)),
    );

  const hasPending = yield* tryOrFail('检查待处理订单', () => OrderReconciliationService.hasPendingOrders(dbClient));
  if (!hasPending) return;

  const r = yield* tryOrFail('执行对账', () => OrderReconciliationService.reconcile(dbClient, query));
  if (r.processed > 0) {
    console.log(`${LOG_PREFIX_RECONCILE} 对账完成: 处理${r.processed}单, 支付成功${r.paid}单, 关闭${r.cancelled}单`);
  }
}).pipe(
  Effect.catch((error) => Effect.sync(() => console.error(`${LOG_PREFIX_RECONCILE} 对账任务失败:`, error))),
  Effect.repeat(Schedule.spaced(OrderReconciliationService.getReconcileIntervalMs())),
);

/** 启动主程序：一次 provide 完整 Layer 树 */
const program = main.pipe(
  Effect.provide(AppLive),
  Effect.catch((error) =>
    Effect.sync(() => {
      console.error(`${LOG_PREFIX_FATAL} 服务启动失败:`, error);
      process.exit(1);
    }),
  ),
);

/** 主 Fiber（startServer 长驻），优雅关闭时中断以停止服务器 */
const mainFiber = Effect.runFork(program);

/** 后台定时任务 Fiber */
loopFibers.push(Effect.runFork(memoryLogLoop.pipe(Effect.provide(AppLive))));
loopFibers.push(Effect.runFork(tokenCleanupLoop.pipe(Effect.provide(AppLive))));
loopFibers.push(Effect.runFork(behaviorLogCleanupLoop.pipe(Effect.provide(AppLive))));
loopFibers.push(Effect.runFork(reconcileLoop.pipe(Effect.provide(AppLive))));

/** 优雅关闭：中断所有 Fiber、停止队列并退出 */
function gracefulShutdown(signal: string) {
  console.log(`${LOG_PREFIX_SHUTDOWN} 收到 ${signal}，开始优雅关闭...`);

  Effect.runFork(Fiber.interruptAll(loopFibers));
  Effect.runFork(Fiber.interrupt(mainFiber));

  if (shutdownQueue) {
    shutdownQueue.stop();
    console.log(`${LOG_PREFIX_SHUTDOWN} 代币发放队列已停止`);
  }

  console.log(`${LOG_PREFIX_SHUTDOWN} 所有定时任务已停止`);
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
