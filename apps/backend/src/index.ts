import { Effect } from 'effect';
import fs from 'fs/promises';
import { loadAppConfig } from './config/loader';
import { AIConfigContext, DefaultAIConfig } from './Context/AIConfig';
import { AIProxyService, AIProxyServiceLive } from './Context/AIProxyService';
import { fail, tryOrFail } from './util/error';
import { AppConfigService } from './Context/AppConfig';
import { PaymentConfigService } from './Context/PaymentConfig';
import { DbClientEffect } from './Context/DbService';
import { seedDB } from './db/seed';
import { startServer } from './server';
import { PrismaQueue } from './util/dbQueue';
import { TokenGrantService } from './services/TokenGrantService';
import { TokenCleanupService } from './services/TokenCleanupService';
import { OrderReconciliationService } from './services/payment/OrderReconciliationService';
import { MS_PER_HOUR, MEMORY_LOG_INTERVAL_MS, QUEUE_STARTUP_DELAY_MS, RECONCILE_STARTUP_DELAY_MS, QUEUE_NAME_GRANT_TOKENS } from './util/constants';

/** 日志前缀 */
const LOG_PREFIX_TOKEN_GRANT = '[TokenGrant]';
const LOG_PREFIX_TOKEN_CLEANUP = '[TokenCleanup]';
const LOG_PREFIX_RECONCILE = '[OrderReconciliation]';
const LOG_PREFIX_FATAL = '[Fatal]';

const main = Effect.gen(function* () {
  const config = yield* AppConfigService;

  /** 确保上传文件夹的路径存在 */
  const dirExists = yield* tryOrFail('检查上传目录', async () => {
    try { return await fs.stat(config.uploadDir); } catch { return null; }
  });
  if (!dirExists) {
    yield* tryOrFail('创建上传目录', () => fs.mkdir(config.uploadDir, { recursive: true }));
    console.log(`Upload directory ${config.uploadDir} is ready`);
  } else if (!dirExists.isDirectory()) {
    return yield* fail(`Upload directory ${config.uploadDir} is not a directory`);
  }

  yield* seedDB

  /** 启动代币发放队列 */
  const dbClient = yield* DbClientEffect;

  type QueueTasks = {
    [QUEUE_NAME_GRANT_TOKENS]: {
      payload: { subscriptionId: number; userId: string };
      result: { success: boolean; skipped?: boolean; reason?: string; userId?: string; packageName?: string; amount?: number; nextGrantDate?: Date };
    };
  };

  const tokenQueue = new PrismaQueue<QueueTasks>({ dbClient });

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

  // 监控内存使用情况（每5秒，仅在数据变化时输出）
  let lastUsage = { rssMB: 0, heapTotalMB: 0 };
  let lastTime = Date.now();

  function logMemoryUsage() {
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
  }

  /** 存储定时器句柄以便 graceful shutdown 时清理 */
  const memoryLogTimer = setInterval(logMemoryUsage, MEMORY_LOG_INTERVAL_MS);

  // 定期清理过期代币（每小时一次，延迟5秒启动确保db已初始化）
  let cleanupIntervalTimer: NodeJS.Timeout;
  const cleanupDelayTimer = setTimeout(() => {
    cleanupIntervalTimer = setInterval(async () => {
      try {
        const totalDeleted = await TokenCleanupService.cleanupExpiredTokens(dbClient);
        if (totalDeleted > 0) {
          console.log(`${LOG_PREFIX_TOKEN_CLEANUP} 清理完成：删除了 ${totalDeleted} 条过期代币记录`);
        }
      } catch (error: unknown) {
        console.error(`${LOG_PREFIX_TOKEN_CLEANUP} 清理任务失败:`, error);
      }
    }, MS_PER_HOUR);
  }, QUEUE_STARTUP_DELAY_MS);

  /** 初始化对账服务的 Effect 查询运行器（在 PaymentConfigService 上下文中） */
  const paymentConfig = yield* PaymentConfigService;
  OrderReconciliationService.initQueryRunner(paymentConfig);

  // 定期对账支付订单（仅在有未处理订单时才执行实际查询）
  // 开发环境: 每60秒（本地无法接收 Webhook，靠轮询模拟）
  // 生产环境: 每5分钟（Webhook 为主，对账仅作兜底）
  let reconcileIntervalTimer: NodeJS.Timeout;
  const reconcileDelayTimer = setTimeout(() => {
    const intervalMs = OrderReconciliationService.getReconcileIntervalMs();
    const isDev = process.env.NODE_ENV !== 'production';
    console.log(`${LOG_PREFIX_RECONCILE} 对账任务已启动 (间隔${isDev ? `${intervalMs / 1000}s` : `${intervalMs / 60000}min`}, ${isDev ? '开发模式' : '生产模式'})`);
    reconcileIntervalTimer = setInterval(async () => {
      try {
        // 快速检查是否有待处理订单
        const hasPending = await OrderReconciliationService.hasPendingOrders(dbClient);
        if (!hasPending) return;

        const r = await OrderReconciliationService.reconcile(dbClient);
        if (r.processed > 0) {
          console.log(`${LOG_PREFIX_RECONCILE} 对账完成: 处理${r.processed}单, 支付成功${r.paid}单, 关闭${r.cancelled}单`);
        }
      } catch (error: unknown) {
        console.error(`${LOG_PREFIX_RECONCILE} 对账任务失败:`, error);
      }
    }, intervalMs);
  }, RECONCILE_STARTUP_DELAY_MS);

  // 启动服务器
  yield* startServer;
});

/** 创建完整的启动程序并提供所有服务 */
const program = Effect.gen(function* () {
  const config = yield* loadAppConfig;
  yield* main.pipe(
    Effect.provideService(AppConfigService, config),
    Effect.provideService(AIProxyService, AIProxyServiceLive),
    Effect.provideService(AIConfigContext, DefaultAIConfig),
    Effect.provideService(PaymentConfigService, config.payment ?? {}),
  );
});

Effect.runPromise(program).catch((e) => {
  console.error(`${LOG_PREFIX_FATAL} 服务启动失败:`, e);
  process.exit(1);
});
