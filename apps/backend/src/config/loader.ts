import { Effect } from 'effect';
import { fail, tryOrFail, MsgError, extractErrorMessage } from '../util/error';
import { MSG } from '../util/constants';
import fs from 'fs/promises';
import path from 'path';
import { type AppConfig as AppConfigType } from '../Context/AppConfig';

/** 日志前缀 */
const LOG_PREFIX = '[ConfigLoader]';

/**
 * 加载配置文件（仅支持 config.json）
 */
export const loadAppConfig: Effect.Effect<AppConfigType, Error, never> = Effect.gen(function* () {
  const configPath = path.join(process.cwd(), 'config.json');

  const configExists = yield* tryOrFail('检查 config.json', async () => {
    try { await fs.access(configPath); return true; } catch { return false; }
  });

  if (configExists) {
    console.log(`${LOG_PREFIX} Loading config from ${configPath}`);
    const configData = yield* tryOrFail('读取 config.json', () => fs.readFile(configPath, 'utf-8'));
    const config = yield* Effect.try({
      try: () => JSON.parse(configData) as AppConfigType,
      catch: (e) => MsgError.msg(`config.json 格式错误: ${extractErrorMessage(e)}`),
    });
    return config;
  }

  if (process.env.NODE_ENV === 'production') {
    console.error(`${LOG_PREFIX} ERROR: No config.json found in production mode. Server will NOT start.`);
    console.error(`${LOG_PREFIX} Create config.json with proper admin credentials and restart.`);
    return yield* fail(MSG.CONFIG_NOT_FOUND);
  }

  console.warn('\x1b[33m%s\x1b[0m', `${LOG_PREFIX} WARNING: No config.json found! Using default admin credentials. This is UNSAFE for production.`);
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
