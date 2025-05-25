import { Effect } from 'effect';
import { seedDB } from './db/seed';
import { startServer } from './server';
import { loadConfig } from 'c12';
import { AppConfigService, type AppConfig } from './service/AppConfigService';
import fs from 'fs/promises';
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
  yield* startServer.pipe(Effect.provideService(AppConfigService, config));
});

Effect.runPromise(main);
