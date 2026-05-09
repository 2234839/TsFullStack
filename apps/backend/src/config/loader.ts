import { Effect } from 'effect';
import { fail, tryOrFail, MsgError, extractErrorMessage } from '../util/error';
import { MSG } from '../util/constants';
import fs from 'fs/promises';
import path from 'path';
import { type AppConfig as AppConfigType } from '../Context/AppConfig';

/** 日志前缀 */
const LOG_PREFIX = '[ConfigLoader]';

/** 校验配置关键字段是否存在 */
function validateConfig(config: unknown): asserts config is AppConfigType {
  if (!config || typeof config !== 'object') {
    throw new Error('config.json 必须是有效对象');
  }
  const c = config as Record<string, unknown>;
  const errors: string[] = [];
  if (!c.systemAdminUser || typeof c.systemAdminUser !== 'object') {
    errors.push('缺少 systemAdminUser');
  } else {
    const admin = c.systemAdminUser as Record<string, unknown>;
    if (!admin.email) errors.push('缺少 systemAdminUser.email');
    if (!admin.password) errors.push('缺少 systemAdminUser.password');
  }
  if (!c.uploadDir) errors.push('缺少 uploadDir');
  if (!c.databasePath) errors.push('缺少 databasePath');
  if (errors.length > 0) {
    throw new Error(`config.json 校验失败: ${errors.join(', ')}`);
  }
}

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
      try: () => {
        const parsed = JSON.parse(configData) as AppConfigType;
        validateConfig(parsed);
        return parsed;
      },
      catch: (e) => MsgError.msg(`config.json 格式错误: ${extractErrorMessage(e)}`),
    });
    return config;
  }

  if (process.env.NODE_ENV === 'production') {
    console.error(`${LOG_PREFIX} ERROR: No config.json found in production mode. Server will NOT start.`);
    console.error(`${LOG_PREFIX} Create config.json with proper admin credentials and restart.`);
    return yield* fail(MSG.CONFIG_NOT_FOUND);
  }

  console.warn('\x1b[33m%s\x1b[0m', `${LOG_PREFIX} WARNING: No config.json found! Using default admin credentials. This is UNSAFE for production. Set ALLOW_INSECURE_DEFAULTS=1 to suppress this warning.`);
  if (!process.env.ALLOW_INSECURE_DEFAULTS) {
    console.error(`${LOG_PREFIX} Refusing to start with default credentials. Set ALLOW_INSECURE_DEFAULTS=1 to allow (development only).`);
    return yield* fail(MSG.CONFIG_NOT_FOUND);
  }
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
