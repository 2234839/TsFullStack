import { Effect } from 'effect';
import fs from 'fs/promises';
import path from 'path';
import { type AppConfig as AppConfigType } from '../Context/AppConfig';

/**
 * 加载配置文件，优先从 config.json 加载，如果不存在则尝试从 config.ts 兼容加载
 */
export const loadAppConfig: Effect.Effect<AppConfigType, Error, never> = Effect.gen(function* () {
  const configPath = path.join(process.cwd(), 'config.json');
  const configTsPath = path.join(process.cwd(), 'config.ts');

  try {
    // 尝试读取 config.json
    const configExists = yield* Effect.promise(() =>
      fs.access(configPath).then(() => true).catch(() => false)
    );

    if (configExists) {
      console.log(`Loading config from ${configPath}`);
      const configData = yield* Effect.promise(() => fs.readFile(configPath, 'utf-8'));
      const config = JSON.parse(configData) as AppConfigType;
      return config;
    }

    // 兼容：尝试读取 config.ts 并转换为 config.json
    const configTsExists = yield* Effect.promise(() =>
      fs.access(configTsPath).then(() => true).catch(() => false)
    );

    if (configTsExists) {
      console.log(`Found ${configTsPath}, converting to ${configPath} for compatibility`);

      // 动态导入 config.ts
      const configModule = yield* Effect.promise(async () => {
        // 使用文件 URL 来确保获取最新内容
        const fileUrl = `file://${configTsPath}`;
        const module = await import(fileUrl);
        return module.default;
      });

      const config = configModule as AppConfigType;

      // 生成 config.json
      yield* Effect.promise(() =>
        fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
      );

      console.log(`Generated ${configPath} from ${configTsPath}`);

      return config;
    }

    // 如果都不存在，返回默认配置
    console.log('No config file found, using default configuration');
    return {
      systemAdminUser: {
        email: 'admin@example.com',
        password: 'adminpassword123',
      },
      uploadDir: './uploads',
      databasePath: './database/dev.db',
      ApiProxy: {},
    } satisfies AppConfigType;

  } catch (error) {
    console.error('Error loading configuration:', error);
    throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

/**
 * 配置服务类，用于加载和管理应用配置
 */
export class ConfigLoader {
  static load(): Effect.Effect<AppConfigType, Error, never> {
    return loadAppConfig;
  }
}