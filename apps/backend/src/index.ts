import { Effect } from 'effect';
import { seedDB } from './db/seed';
import { startServer } from './server';
import { loadConfig } from 'c12';
import { AppConfigService, type AppConfig } from './service/AppConfigService';
import fs from 'fs/promises';
import { PrismaQueue } from './util/prismaQueue';
import { prisma } from './db';
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

  type MyTasks = {
    sendEmail: {
      payload: { to: string; subject: string };
      result: { sent: boolean };
    };
  };
  const queue = new PrismaQueue<MyTasks>({ prisma });
  // 注册任务
  queue.register('sendEmail', async (payload) => {
    console.log(`Send email to ${payload.to}, subject: ${payload.subject}`);
    throw new Error('测试错误');
    return { sent: true };
  });

  // 启动队列
  queue.start();
  // 添加任务
  // queue.add('sendEmail', { to: 'alice@example.com', subject: '欢迎 Alice' });
  yield* startServer.pipe(Effect.provideService(AppConfigService, config));
});

Effect.runPromise(main);
