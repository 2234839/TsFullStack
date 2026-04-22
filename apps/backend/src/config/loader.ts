import { Effect } from 'effect';
import fs from 'fs/promises';
import path from 'path';
import { type AppConfig as AppConfigType } from '../Context/AppConfig';
import { MsgError } from '../util/error';

/**
 * 加载配置文件，优先从 config.json 加载，如果不存在则尝试从 config.ts 兼容加载
 */
export const loadAppConfig: Effect.Effect<AppConfigType, Error, never> = Effect.gen(function* () {
  const configPath = path.join(process.cwd(), 'config.json');
  const configTsPath = path.join(process.cwd(), 'config.ts');

  try {
    // 尝试读取 config.json
    const configExists = yield* Effect.tryPromise({
      try: () => fs.access(configPath).then(() => true).catch(() => false),
      catch: (e) => MsgError.msg('检查 config.json 失败: ' + String(e)),
    });

    if (configExists) {
      console.log('[ConfigLoader] Loading config from ' + configPath);
      const configData = yield* Effect.tryPromise({
        try: () => fs.readFile(configPath, 'utf-8'),
        catch: (e) => MsgError.msg('读取 config.json 失败: ' + String(e)),
      });
      const config = yield* Effect.try({
        try: () => JSON.parse(configData) as AppConfigType,
        catch: (e) => MsgError.msg('config.json 格式错误: ' + String(e)),
      });
      return config;
    }

    // 兼容：尝试读取 config.ts 并转换为 config.json
    const configTsExists = yield* Effect.tryPromise({
      try: () => fs.access(configTsPath).then(() => true).catch(() => false),
      catch: (e) => MsgError.msg('检查 config.ts 失败: ' + String(e)),
    });

    if (configTsExists) {
      console.log('[ConfigLoader] Converting config.ts → config.json');

      // 动态导入 config.ts
      const configModule = yield* Effect.tryPromise({
        try: async () => {
          // 使用文件 URL 来确保获取最新内容
          const fileUrl = `file://${configTsPath}`;
          const module = await import(fileUrl);
          return module.default;
        },
        catch: (e) => MsgError.msg('动态导入 config.ts 失败: ' + String(e)),
      });

      const config = configModule as AppConfigType;

      // 生成 config.json
      yield* Effect.tryPromise({
        try: () => fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8'),
        catch: (e) => MsgError.msg('写入 config.json 失败: ' + String(e)),
      });

      console.log('[ConfigLoader] Generated config.json');

      return config;
    }

    // 如果都不存在，返回默认配置
    console.warn('\x1b[33m%s\x1b[0m', '[ConfigLoader] WARNING: No config file found! Using default admin credentials. This is UNSAFE for production. Create config.json to override.');
    return {
      systemAdminUser: {
        email: 'admin@example.com',
        password: 'adminpassword123',
      },
      uploadDir: './uploads',
      databasePath: './database/dev.db',
      ApiProxy: {},
    } satisfies AppConfigType;

  } catch (error: unknown) {
    console.error('Error loading configuration:', error);
    throw MsgError.msg(`配置加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
});

/** 加载并返回应用配置（Effect 程序可直接 yield* 使用） */
export const AppConfigEffect = loadAppConfig;
