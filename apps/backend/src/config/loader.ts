import { Effect } from 'effect';
import { fail, neverReturn } from '../util/error';
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

  // 尝试读取 config.json
  const configExists = yield* Effect.tryPromise({
    try: async () => { try { await fs.access(configPath); return true; } catch { return false; } },
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
    try: async () => { try { await fs.access(configTsPath); return true; } catch { return false; } },
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

  // 如果都不存在，生产环境拒绝启动，开发环境返回默认配置
  if (process.env.NODE_ENV === 'production') {
    console.error('[ConfigLoader] ERROR: No config file found in production mode. Server will NOT start with default credentials.');
    console.error('[ConfigLoader] Create config.json with proper admin credentials and restart.');
    yield* fail('生产环境缺少配置文件，请创建 config.json');
    return neverReturn();
  }

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
});

/** 加载并返回应用配置（Effect 程序可直接 yield* 使用） */
