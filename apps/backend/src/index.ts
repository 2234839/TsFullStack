import { Effect } from 'effect';
import fs from 'fs/promises';
import { ConfigLoader } from './config/loader';
import { AIConfigContext, DefaultAIConfig } from './Context/AIConfig';
import { AIProxyService, AIProxyServiceLive } from './Context/AIProxyService';
import { AppConfigService } from './Context/AppConfig';
import { DbClientEffect } from './Context/DbService';
import { seedDB } from './db/seed';
import { startServer } from './server';
import { PrismaQueue } from './util/dbQueue';
import { QueueScheduler } from './util/QueueScheduler';
const main = Effect.gen(function* () {
  const config = yield* AppConfigService;

  // 确保上传文件夹的路径存在
  const dirExists = yield* Effect.promise(() => fs.stat(config.uploadDir).catch(() => null));
  if (!dirExists) {
    yield* Effect.promise(() => fs.mkdir(config.uploadDir, { recursive: true }));
    console.log(`Upload directory ${config.uploadDir} is ready`);
  } else if (!dirExists.isDirectory()) {
    throw new Error(`Upload directory ${config.uploadDir} is not a directory`);
  }

  yield* seedDB

  // 启动代币发放队列
  const dbClient = yield* DbClientEffect;

  // 定义队列任务类型
  type QueueTasks = {
    grantSubscriptionTokens: {
      payload: { subscriptionId: number; userId: string };
      result: { success: boolean; skipped?: boolean; reason?: string; userId?: string; packageName?: string; amount?: number; nextGrantDate?: Date };
    };
  };

  const tokenQueue = new PrismaQueue<QueueTasks>({ dbClient });

  // 注册代币发放任务处理器
  tokenQueue.register('grantSubscriptionTokens', async (payload) => {
    // 创建 Effect 程序并提供必要的上下文
    const program = Effect.gen(function* () {
      const db = yield* DbClientEffect;

      // 直接使用数据库客户端执行代币发放逻辑
      const subscription = yield* Effect.promise(() =>
        db.userTokenSubscription.findFirst({
          where: {
            id: payload.subscriptionId,
            userId: payload.userId,
            active: true,
          },
          include: {
            package: true,
          },
        }),
      );

      if (!subscription) {
        console.log(`[TokenGrant] 订阅 ${payload.subscriptionId} 不存在或已取消，跳过发放`);
        return { success: false, skipped: true, reason: '订阅不存在或已取消' };
      }

      // 检查订阅是否已过期
      if (subscription.endDate && new Date() > subscription.endDate) {
        console.log(`[TokenGrant] 订阅 ${payload.subscriptionId} 已过期，跳过发放`);

        // 停用订阅
        yield* Effect.promise(() =>
          db.userTokenSubscription.update({
            where: { id: subscription.id },
            data: { active: false },
          }),
        );

        return { success: false, skipped: true, reason: '订阅已过期' };
      }

      // 检查套餐是否启用
      if (!subscription.package.active) {
        console.log(`[TokenGrant] 套餐 ${subscription.package.id} 已停用，跳过发放`);
        return { success: false, skipped: true, reason: '套餐已停用' };
      }

      // 计算发放周期和过期时间
      const grantIntervalDays = subscription.package.type === 'MONTHLY' ? 30 : 365;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + grantIntervalDays * 24 * 60 * 60 * 1000);

      // 发放代币
      yield* Effect.promise(() =>
        db.token.create({
          data: {
            userId: subscription.userId,
            type: subscription.package.type as 'MONTHLY' | 'YEARLY' | 'PERMANENT',
            amount: subscription.package.amount,
            used: 0,
            expiresAt,
            source: 'subscription',
            sourceId: String(subscription.id),
            description: `套餐自动发放：${subscription.package.name}`,
          },
        }),
      );

      // 计算下次发放时间
      const nextGrantDate = new Date(now.getTime() + grantIntervalDays * 24 * 60 * 60 * 1000);

      // 更新订阅记录
      yield* Effect.promise(() =>
        db.userTokenSubscription.update({
          where: { id: subscription.id },
          data: {
            nextGrantDate,
            grantsCount: { increment: 1 },
          },
        }),
      );

      // 创建下一次的定时发放任务
      yield* Effect.promise(() =>
        db.queue.create({
          data: {
            name: 'grantSubscriptionTokens',
            payload: {
              subscriptionId: subscription.id,
              userId: subscription.userId,
            },
            status: 'PENDING',
            priority: 5,
            runAt: nextGrantDate,
            maxAttempts: 3,
          },
        }),
      );

      console.log(
        `[TokenGrant] 用户 ${subscription.userId} 的订阅 ${subscription.package.name} 自动发放 ${subscription.package.amount} 代币，下次发放时间: ${nextGrantDate.toISOString()}`
      );

      return {
        success: true,
        userId: subscription.userId,
        packageName: subscription.package.name,
        amount: subscription.package.amount,
        nextGrantDate,
      };
    });

    // 提供 AppConfigService 上下文并运行
    return Effect.runPromise(
      Effect.provideService(program, AppConfigService, config),
    );
  });

  // 启动队列
  tokenQueue.start();
  console.log('[TokenGrant] 代币发放队列已启动');

  // 监控内存使用情况
  let lastUsage = { rssMB: 0, heapTotalMB: 0 };
  let lastTime = Date.now();

  function logMemoryUsage() {
    const usage = process.memoryUsage();
    const currentTime = Date.now();

    const rssMB = Math.round(usage.rss / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);

    // 检查是否有变化
    const hasChanged = rssMB !== lastUsage.rssMB || heapTotalMB !== lastUsage.heapTotalMB;

    // 只有在数据有变化时才输出日志
    if (hasChanged) {
      let msg = `内存波动: 常驻内存 ${rssMB} MB  堆总大小 ${heapTotalMB} MB`;

      const rssDiff = rssMB - lastUsage.rssMB;
      const heapDiff = heapTotalMB - lastUsage.heapTotalMB;
      const timeDiff = currentTime - lastTime;

      // 标注增减情况
      const rssChange = rssDiff > 0 ? `↑${rssDiff}` : rssDiff < 0 ? `↓${Math.abs(rssDiff)}` : '→0';
      const heapChange =
        heapDiff > 0 ? `↑${heapDiff}` : heapDiff < 0 ? `↓${Math.abs(heapDiff)}` : '→0';

      msg += ` [常驻内存变化: ${rssChange} MB, 堆总大小变化: ${heapChange} MB, 时间间隔: ${timeDiff} ms]`;

      console.log(msg);
    }

    // 更新上一次的内存使用情况和时间
    lastUsage = {
      rssMB: rssMB,
      heapTotalMB: heapTotalMB,
    };
    lastTime = currentTime;
  }

  setInterval(logMemoryUsage, 5_000);

  // 定期清理过期代币（每小时一次）
  let dbClientForCleanup: any = null;

  // 保存dbClient引用以便后续使用
  Effect.runPromise(
    Effect.gen(function* () {
      dbClientForCleanup = yield* DbClientEffect;
    }).pipe(
      Effect.provideService(AppConfigService, config)
    )
  );

  // 启动定时清理任务
  setTimeout(() => {
    setInterval(async () => {
      if (!dbClientForCleanup) {
        return; // dbClient还未初始化
      }

      try {
        const now = new Date();
        const BATCH_SIZE = 1000;
        let totalDeleted = 0;
        let hasMore = true;

        while (hasMore) {
          const tokensToCleanup = await dbClientForCleanup.token.findMany({
            where: {
              active: true,
              expiresAt: { lt: now },
            },
            select: {
              id: true,
              amount: true,
              used: true,
            },
            take: BATCH_SIZE,
          });

          if (tokensToCleanup.length === 0) {
            hasMore = false;
            break;
          }

          const tokenIdsToDelete = tokensToCleanup
            .filter((t: { id: number; amount: number; used: number }) => t.used >= t.amount)
            .map((t: { id: number; amount: number; used: number }) => t.id);

          if (tokenIdsToDelete.length > 0) {
            await dbClientForCleanup.token.deleteMany({
              where: {
                id: { in: tokenIdsToDelete },
              },
            });
            totalDeleted += tokenIdsToDelete.length;
          }

          if (tokensToCleanup.length < BATCH_SIZE) {
            hasMore = false;
          }
        }

        if (totalDeleted > 0) {
          console.log(`[TokenCleanup] 清理完成：删除了 ${totalDeleted} 条过期代币记录`);
        }
      } catch (error) {
        console.error('[TokenCleanup] 清理任务失败:', error);
      }
    }, 3600_000); // 每小时执行一次
  }, 5000); // 延迟5秒启动，确保dbClient已初始化

  // yield* queue_scheduler;
  yield* startServer.pipe(
    Effect.provideService(AppConfigService, config),
    Effect.provideService(AIProxyService, AIProxyServiceLive),
    Effect.provideService(AIConfigContext, DefaultAIConfig),
  );
});

// 创建完整的启动程序并提供所有服务
const program = Effect.gen(function* () {
  const config = yield* ConfigLoader.load();
  yield* main.pipe(
    Effect.provideService(AppConfigService, config),
    Effect.provideService(AIProxyService, AIProxyServiceLive),
    Effect.provideService(AIConfigContext, DefaultAIConfig),
  );
});

Effect.runPromise(program);

/** 队列与定时任务调度 */
const queue_scheduler = Effect.gen(function* () {
  type MyTasks = {
    sendEmail: {
      payload: { to: string; subject: string };
      result: { sent: boolean };
    };
  };
  const dbClient = yield* DbClientEffect;
  const queue = new PrismaQueue<MyTasks>({ dbClient });
  // 注册任务
  queue.register('sendEmail', async (payload) => {
    // throw new Error('failTask');
    return { sent: true };
  });
  // 启动队列v
  // queue.start();
  // 添加任务
  setTimeout(() => {
    // queue.add('sendEmail', { to: 'alice@example.com', subject: '欢迎 Alice' });
  }, 1_000);
  const scheduler = new QueueScheduler(
    queue,
    'tenSecondTask',
    async () => {
      console.log('十秒任务触发，执行业务逻辑', new Date().toISOString());
      // 这里写你的业务逻辑，比如发出其他任务
      return { sent: '执行成功' };
    },
    (lastRun) => {
      // lastRun 是上次触发时间，返回下次触发时间 = 当前时间 + 10秒
      return new Date(Date.now() + 10_000);
    },
  );

  // 启动调度，5秒后首次触发
  // scheduler.start(new Date(Date.now() + 5000));
});
