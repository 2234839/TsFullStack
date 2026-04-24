import { Effect } from 'effect';
import { fail, neverReturn } from '../util/error';
import fs from 'fs/promises';
import path from 'path';
import { type AppConfig as AppConfigType } from '../Context/AppConfig';
import { MsgError } from '../util/error';

/**
 * 加载配置文件（仅支持 config.json）
 */
export const loadAppConfig: Effect.Effect<AppConfigType, Error, never> = Effect.gen(function* () {
  const configPath = path.join(process.cwd(), 'config.json');

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

  if (process.env.NODE_ENV === 'production') {
    console.error('[ConfigLoader] ERROR: No config.json found in production mode. Server will NOT start.');
    console.error('[ConfigLoader] Create config.json with proper admin credentials and restart.');
    yield* fail('生产环境缺少配置文件，请创建 config.json');
    return neverReturn();
  }

  console.warn('\x1b[33m%s\x1b[0m', '[ConfigLoader] WARNING: No config.json found! Using default admin credentials. This is UNSAFE for production.');
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
