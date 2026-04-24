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
  /** CORS 允许的来源（空数组或未设置则允许所有来源） */
  corsOrigins?: string[];
  /** AI 图片生成服务配置 */
  aiImage?: {
    /** 通义千问 API Key */
    qwenApiKey?: string;
    /** DALL-E API Key */
    dalleApiKey?: string;
    /** Stability AI API Key */
    stabilityApiKey?: string;
    /** 智谱 GLM API Key */
    glmApiKey?: string;
  };
  /** 支付配置 */
  payment?: {
    /** 面包多配置 */
    mbd?: {
      enabled: boolean;
      appId: string;
      appKey: string;
    };
    /** 爱发电配置 */
    afdian?: {
      enabled: boolean;
      userId: string;           // 创作者页面 URL 中的 ID (用于构建赞助链接)
      apiUserId: string;        // API 调用身份 (用于签名、查订单)
      apiKey: string;            // API Token
      webhookToken: string;       // Webhook 验证 Token
    };
    /** 微信好友支付配置（站长人工确认到账） */
    wechat?: {
      enabled: boolean;
      /** 站长微信号 */
      accountId: string;
      /** 站长微信昵称（展示用） */
      accountName: string;
    };
    /** 订单过期时间（分钟） */
    orderExpireMinutes?: number;
  };
};
