import { Effect } from 'effect';
import fs from 'fs/promises';
import { loadAppConfig } from './config/loader';
import { AIConfigContext, DefaultAIConfig } from './Context/AIConfig';
import { AIProxyService, AIProxyServiceLive } from './Context/AIProxyService';
import { MsgError } from './util/error';
import { AppConfigService } from './Context/AppConfig';
import { DbClientEffect } from './Context/DbService';
import { seedDB } from './db/seed';
import { startServer } from './server';
import { PrismaQueue } from './util/dbQueue';
import { TokenGrantService } from './services/TokenGrantService';
import { TokenCleanupService } from './services/TokenCleanupService';
import { MS_PER_HOUR, MEMORY_LOG_INTERVAL_MS, QUEUE_STARTUP_DELAY_MS } from './util/constants';

const main = Effect.gen(function* () {
  const config = yield* AppConfigService;

  // 确保上传文件夹的路径存在
  const dirExists = yield* Effect.tryPromise({
    try: () => fs.stat(config.uploadDir).catch(() => null),
    catch: (e) => MsgError.msg('检查上传目录失败: ' + String(e)),
  });
  if (!dirExists) {
    yield* Effect.tryPromise({
      try: () => fs.mkdir(config.uploadDir, { recursive: true }),
      catch: (e) => MsgError.msg('创建上传目录失败: ' + String(e)),
    });
    console.log(`Upload directory ${config.uploadDir} is ready`);
  } else if (!dirExists.isDirectory()) {
    throw MsgError.msg(`Upload directory ${config.uploadDir} is not a directory`);
  }

  yield* seedDB

  // 启动代币发放队列
  const dbClient = yield* DbClientEffect;

  type QueueTasks = {
    grantSubscriptionTokens: {
      payload: { subscriptionId: number; userId: string };
      result: { success: boolean; skipped?: boolean; reason?: string; userId?: string; packageName?: string; amount?: number; nextGrantDate?: Date };
    };
  };

  const tokenQueue = new PrismaQueue<QueueTasks>({ dbClient });

  // 注册代币发放任务处理器（委托给 TokenGrantService）
  tokenQueue.register('grantSubscriptionTokens', async (payload) => {
    const result = await TokenGrantService.processSubscriptionGrant(payload, dbClient);

    if (result.success) {
      console.log(
        `[TokenGrant] 用户 ${result.userId} 的订阅 ${result.packageName} 自动发放 ${result.amount} 代币，下次发放时间: ${result.nextGrantDate?.toISOString()}`,
      );
    } else {
      console.log(`[TokenGrant] ${result.reason}，跳过发放`);
    }

    return result;
  });

  // 启动队列
  tokenQueue.start();
  console.log('[TokenGrant] 代币发放队列已启动');

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

  setInterval(logMemoryUsage, MEMORY_LOG_INTERVAL_MS);

  // 定期清理过期代币（每小时一次，延迟5秒启动确保db已初始化）
  setTimeout(() => {
    setInterval(async () => {
      try {
        const totalDeleted = await TokenCleanupService.cleanupExpiredTokens(dbClient);
        if (totalDeleted > 0) {
          console.log(`[TokenCleanup] 清理完成：删除了 ${totalDeleted} 条过期代币记录`);
        }
      } catch (error: unknown) {
        console.error('[TokenCleanup] 清理任务失败:', error);
      }
    }, MS_PER_HOUR);
  }, QUEUE_STARTUP_DELAY_MS);

  // 启动服务器
  yield* startServer.pipe(
    Effect.provideService(AppConfigService, config),
    Effect.provideService(AIProxyService, AIProxyServiceLive),
    Effect.provideService(AIConfigContext, DefaultAIConfig),
  );
});

// 创建完整的启动程序并提供所有服务
const program = Effect.gen(function* () {
  const config = yield* loadAppConfig;
  yield* main.pipe(
    Effect.provideService(AppConfigService, config),
    Effect.provideService(AIProxyService, AIProxyServiceLive),
    Effect.provideService(AIConfigContext, DefaultAIConfig),
  );
});

Effect.runPromise(program);
