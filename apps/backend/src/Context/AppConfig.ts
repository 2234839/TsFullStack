import { Context } from 'effect';
export class AppConfigService extends Context.Tag('AppConfigService')<
  AppConfigService,
  AppConfig
>() {}

/** 请求上下文数据 */
export type AppConfig = {
  /** 上传文件的目录 */
  uploadDir: string;
  /** 数据库文件路径 */
  databasePath: string;
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
  /** 用于代理一些api的请求，例如github oauth 认证，在国内服务器上就有可能无法访问对应的接口
   * 这里通过填写 api-proxy 来通过能够访问对应服务的 cloudflare works 代理请求*/
  ApiProxy: {
    github?: string;
  };
};
