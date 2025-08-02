import { Context } from 'effect';
export class AppConfigContext extends Context.Tag('AppConfigService')<
  AppConfigContext,
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
  /** github OAuth 登录
   */
  OAuth_github?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope?: string[];
  };
};
