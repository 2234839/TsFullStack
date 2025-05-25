import { Context } from 'effect';
export class AppConfigService extends Context.Tag('AppConfigService')<
  AppConfigService,
  AppConfig
>() {}

/** 请求上下文数据 */
export type AppConfig = {
  /** 上传文件的目录 */
  uploadDir: string;
  /** 用于配置管理员帐号 */
  systemAdminUser: {
    email: string;
    password: string;
  };
};

// /** 确保所有配置项可用 */
// export async function seedConfig() {
//   const { config } = await loadConfig({});

//   const dirExists = await fs.stat(AppConfig.uploadDir).catch(() => null);
//   if (!dirExists) {
//     await fs.mkdir(AppConfig.uploadDir, { recursive: true });
//     console.log(`Upload directory ${AppConfig.uploadDir} is ready`);
//   } else if (!dirExists.isDirectory()) {
//     throw new Error(`Upload directory ${AppConfig.uploadDir} is not a directory`);
//   }
// }
