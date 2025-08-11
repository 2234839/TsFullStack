import { Effect } from 'effect';
import { seedDB } from './db/seed';
import { startServer } from './server';
import { loadConfig } from 'c12';
import { AppConfigContext, type AppConfig } from './Context/AppConfig';
import fs from 'fs/promises';
import { PrismaQueue } from './util/prismaQueue';
import { PrismaService, PrismaServiceLive } from './Context/PrismaService';
import { QueueScheduler } from './util/QueueScheduler';
const main = Effect.gen(function* () {
  const { config } = yield* Effect.promise(() =>
    loadConfig<AppConfig>({
      defaultConfig: () => {
        return {
          systemAdminUser: {
            email: 'admin@example.com',
            password: 'adminpassword123',
          },
          uploadDir: './uploads',
          ApiProxy: {},
        } satisfies AppConfig;
      },
    }),
  );

  // 确保上传文件夹的路径存在
  const dirExists = yield* Effect.promise(() => fs.stat(config.uploadDir).catch(() => null));
  if (!dirExists) {
    yield* Effect.promise(() => fs.mkdir(config.uploadDir, { recursive: true }));
    console.log(`Upload directory ${config.uploadDir} is ready`);
  } else if (!dirExists.isDirectory()) {
    throw new Error(`Upload directory ${config.uploadDir} is not a directory`);
  }

  yield* seedDB.pipe(
    Effect.provideService(AppConfigContext, config),
    Effect.provideService(PrismaService, PrismaServiceLive),
  );

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

  setInterval(logMemoryUsage, 1_000);

  // yield* queue_scheduler;
  yield* startServer.pipe(
    Effect.provideService(AppConfigContext, config),
    Effect.provideService(PrismaService, PrismaServiceLive),
  );
});

Effect.runPromise(main as Effect.Effect<void, unknown, never>);

/** 队列与定时任务调度 */
const queue_scheduler = Effect.gen(function* () {
  type MyTasks = {
    sendEmail: {
      payload: { to: string; subject: string };
      result: { sent: boolean };
    };
  };
  const { prisma } = yield* PrismaService;
  const queue = new PrismaQueue<MyTasks>({ prisma });
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
