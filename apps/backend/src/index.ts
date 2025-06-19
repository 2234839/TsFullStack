import { Effect } from 'effect';
import { seedDB } from './db/seed';
import { startServer } from './server';
import { loadConfig } from 'c12';
import { AppConfigService, type AppConfig } from './service/AppConfigService';
import fs from 'fs/promises';
import { PrismaQueue } from './util/prismaQueue';
import { prisma } from './db';
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

  yield* seedDB.pipe(Effect.provideService(AppConfigService, config));
  // yield* queue_scheduler;
  yield* startServer.pipe(Effect.provideService(AppConfigService, config));
});

Effect.runPromise(main);

/** 队列与定时任务调度 */
const queue_scheduler = Effect.gen(function* () {
  type MyTasks = {
    sendEmail: {
      payload: { to: string; subject: string };
      result: { sent: boolean };
    };
  };
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
