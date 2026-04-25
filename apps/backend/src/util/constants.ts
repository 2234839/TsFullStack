/** 时间常量（毫秒单位） */
const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/** 会话过期时间（7天） */
export const SESSION_EXPIRY_MS = 7 * MS_PER_DAY;

/** CORS 预检缓存最大年龄（24小时） */
export const CORS_MAX_AGE_SECONDS = 24 * 60 * 60;

/** 文件上传大小限制 (1GB) */
export const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;

/** 默认分页参数 */
export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_PAGE_SIZE_LARGE = 100;

/** 服务器配置 */
export const SERVER_PORT = 5209;
export const SERVER_HOST = '0.0.0.0';
export const MAX_WAIT_MS = 360_000;

/** 内存监控日志间隔（5秒） */
export const MEMORY_LOG_INTERVAL_MS = 50_000;

/** 队列启动延迟（5秒，确保数据库已初始化） */
export const QUEUE_STARTUP_DELAY_MS = 5 * MS_PER_SECOND;

/** 对账服务启动延迟（10秒，确保服务器就绪后才开始对账） */
export const RECONCILE_STARTUP_DELAY_MS = 10 * MS_PER_SECOND;

/** 外部 API 超时（毫秒） */
export const GITHUB_FETCH_TIMEOUT_MS = 15_000;
export const IMAGE_DOWNLOAD_TIMEOUT_MS = 30_000;
export const AI_IMAGE_API_TIMEOUT_MS = 60_000;
export const OPENAI_PROXY_TIMEOUT_MS = 120_000;
export const OLLAMA_API_TIMEOUT_MS = 60_000;
/** 支付平台 API 超时（毫秒） */
export const PAYMENT_API_TIMEOUT_MS = 30_000;

/** JSON 请求的标准 Content-Type 请求头 */
export const JSON_CONTENT_HEADERS = { 'Content-Type': 'application/json' } as const;

/** 深拷贝为 JSON 安全值（用于 ZenStack Json 字段赋值） */
export function deepCloneToJson<T>(value: T): ReturnType<typeof JSON.parse> {
  return JSON.parse(JSON.stringify(value));
}

/** ID 最大长度（防止 DoS） */
export const MAX_ID_LENGTH = 100;

/** 文件名最大长度 */
export const MAX_FILENAME_LENGTH = 255;

/** Webhook 日志最大载荷长度 */
export const WEBHOOK_MAX_LOG_PAYLOAD = 500;

/** 业务错误消息常量（跨层复用，避免硬编码重复） */
export const MSG = {
  /** 任务不存在（TaskService + TokenService 共用） */
  TASK_NOT_FOUND: '任务不存在',
  /** 套餐不存在（TokenPackageService + tokenPackageApi 共用） */
  PACKAGE_NOT_FOUND: '套餐不存在',
  /** 代币数量必须大于0（TokenPackageService + tokenPackageApi 共用） */
  TOKEN_AMOUNT_POSITIVE: '代币数量必须大于0',
  /** 文件不存在（FileAccessService + file API 共用） */
  FILE_NOT_FOUND: '文件不存在',
  /** 文件所有权校验失败（FilePathService + FileAccessService 共用） */
  FILE_ACCESS_DENIED: 'Access denied: File ownership verification failed',
  /** 订单不存在（PaymentService + paymentApi 共用） */
  ORDER_NOT_FOUND: '订单不存在',
  /** 参数格式错误（server/index.ts parseParams 多处共用） */
  PARAM_FORMAT_ERROR: '参数格式错误: 期望数组类型',
  /** 套餐已停用（PaymentService + tokenPackageApi 共用） */
  PACKAGE_DISABLED: '该套餐已停用',
  /** 权限不足（server/index.ts ZenStack 错误映射） */
  ACCESS_DENIED: '权限不足',
  /** 记录不存在或已被删除（server/index.ts ORM 错误映射） */
  RECORD_NOT_FOUND: '记录不存在或已被删除',
  /** 数据验证失败（server/index.ts ZenStack 校验错误） */
  VALIDATION_FAILED: '数据验证失败，请检查输入',
  /** 无权访问/修改或记录不存在（server/index.ts ZenStack NOT_FOUND 映射） */
  NO_ACCESS_OR_NOT_FOUND: '无权访问/修改或记录不存在',
  /** 需要管理员权限（Auth.ts requireAdmin） */
  REQUIRE_ADMIN: '需要管理员权限',
  /** 只能取消待支付的订单（PaymentService cancelOrder） */
  CANCEL_PENDING_ONLY: '只能取消待支付的订单',
  /** 套餐不支持在线购买（PaymentService createOrder） */
  PACKAGE_NO_ONLINE_PURCHASE: '该套餐不支持在线购买（价格未设置）',
  /** 无权访问此任务（TaskService getTask） */
  TASK_ACCESS_DENIED: '无权访问此任务',
  /** 文件不存在或无权访问（FileAccessService） */
  FILE_NOT_FOUND_OR_NO_ACCESS: '文件不存在或无权访问',
  /** 服务器繁忙（server/index.ts 全局兜底） */
  SERVER_BUSY: '服务器繁忙，请稍后再试',
  /** 套餐名称不能为空（TokenPackageService） */
  PACKAGE_NAME_REQUIRED: '套餐名称不能为空',
  /** 套餐时长不能为负数（TokenPackageService） */
  PACKAGE_DURATION_INVALID: '套餐时长不能为负数',
  /** 代币不足（TokenService consumeTokens，动态拼接） */
  TOKEN_INSUFFICIENT: '代币不足',
  /** 邮箱格式不正确（appApi register/login） */
  EMAIL_FORMAT_INVALID: '邮箱格式不正确',
  /** 密码长度不能少于6位（appApi register） */
  PASSWORD_TOO_SHORT: '密码长度不能少于6位',
  /** 密码长度不能超过200位（appApi register） */
  PASSWORD_TOO_LONG: '密码长度不能超过200位',
  /** 用户已存在（appApi register） */
  USER_ALREADY_EXISTS: '用户已存在',
  /** 密码不能为空（appApi login） */
  PASSWORD_REQUIRED: '密码不能为空',
  /** 用户不存在或账户密码错误（appApi login） */
  LOGIN_FAILED: '用户不存在或账户密码错误',
  /** 套餐ID无效（paymentApi createOrder） */
  PACKAGE_ID_INVALID: '套餐ID无效',
  /** 仅支持确认微信好友支付的订单（paymentApi confirmWechatOrder） */
  WECHAT_ORDER_ONLY: '仅支持确认微信好友支付的订单',
  /** 该订单已经确认过了（paymentApi confirmWechatOrder） */
  ORDER_ALREADY_CONFIRMED: '该订单已经确认过了',
  /** 只能确认待支付或支付失败的订单（paymentApi confirmWechatOrder） */
  ORDER_STATUS_INVALID_FOR_CONFIRM: '只能确认待支付或支付失败的订单',
  /** 订单缺少关联套餐信息（paymentApi confirmWechatOrder） */
  ORDER_MISSING_PACKAGE: '订单缺少关联套餐信息',
  /** 用户已订阅此套餐，请勿重复订阅（tokenPackageApi） */
  SUBSCRIPTION_ALREADY_EXISTS: '用户已订阅此套餐，请勿重复订阅',
  /** 下载图片失败（taskApi selectAndDownloadImage） */
  IMAGE_DOWNLOAD_FAILED: '下载图片失败',
  /** 读取图片数据失败（taskApi selectAndDownloadImage） */
  IMAGE_READ_FAILED: '读取图片数据失败',
  /** sharp 模块未安装（taskApi selectAndDownloadImage） */
  SHARP_NOT_INSTALLED: 'sharp 模块未安装',
  /** 未找到支付平台适配器（adapter-registry，动态拼接 provider） */
  PROVIDER_ADAPTER_NOT_FOUND: '未找到支付平台适配器',
  /** restrictedType 格式错误（TokenService grantTokens） */
  RESTRICTED_TYPE_INVALID: 'restrictedType 必须为字符串数组或 null',
  /** 无效的图片URL格式（taskApi validateImageUrl） */
  INVALID_IMAGE_URL: '无效的图片URL格式',
  /** 提示词不能为空（taskApi generateAIImage） */
  PROMPT_REQUIRED: '提示词不能为空',
  /** 尺寸格式无效（taskApi generateAIImage） */
  INVALID_SIZE_FORMAT: '不支持的尺寸格式',
  /** taskId 无效（taskApi selectAndDownloadImage） */
  INVALID_TASK_ID: 'taskId 无效',
  /** 代币费用计算异常（taskApi generateAIImage） */
  TOKEN_FEE_ERROR: '代币费用计算异常',
  /** 用户ID不能为空（tokenPackageApi validateUserId） */
  USER_ID_REQUIRED: '用户ID不能为空',
  /** 单次发放代币数量不能超过100万（tokenPackageApi grantTokensToUser） */
  TOKEN_GRANT_LIMIT_EXCEEDED: '单次发放代币数量不能超过100万',
  /** 无效的代币类型（tokenPackageApi grantTokensToUser） */
  INVALID_TOKEN_TYPE: '无效的代币类型',
  /** 套餐ID必须大于0（tokenPackageApi subscribeToPackage） */
  PACKAGE_ID_MUST_BE_POSITIVE: '套餐ID必须大于0',
  /** 微信好友支付未启用或缺少配置（wechat.adapter） */
  WECHAT_NOT_ENABLED: '微信好友支付未启用或缺少微信号配置',
  /** 微信好友支付不支持 Webhook（wechat.adapter） */
  WECHAT_NO_WEBHOOK: '微信好友支付不支持 Webhook 回调',
  /** 爱发电未启用或缺少配置（afdian.adapter） */
  AFDIAN_NOT_ENABLED: '爱发电未启用或缺少配置(userId)',
  /** 爱发电未配置（afdian.adapter webhook） */
  AFDIAN_NOT_CONFIGURED: '爱发电未配置',
  /** 爱发电回调数据为空（afdian.adapter） */
  AFDIAN_WEBHOOK_EMPTY: '爱发电回调数据为空',
  /** 面包多未启用或缺少配置（mbd.adapter） */
  MBD_NOT_ENABLED: '面包多未启用或缺少配置(appId/appKey)',
  /** 爱发电未配置 userId 或 apiKey（paymentApi） */
  AFDIAN_MISSING_CREDENTIALS: '爱发电未配置 userId 或 apiKey',
  /** 没有可用的AI模型（AIProxyService） */
  NO_AI_MODEL_AVAILABLE: '没有可用的AI模型',
  /** OAuth GitHub 未配置（github.ts） */
  OAUTH_GITHUB_NOT_CONFIGURED: '未配置 OAuth_github',
  /** 生产环境缺少配置文件（config/loader.ts） */
  CONFIG_NOT_FOUND: '生产环境缺少配置文件，请创建 config.json',
  /** 查询用户参数无效（DbService） */
  INVALID_QUERY_OPTIONS: '查询参数无效',
  /** 内容不能为空（infoQuality.ts） */
  CONTENT_REQUIRED: '内容不能为空',
  /** saveFile 必须提供数据（file.ts） */
  SAVE_FILE_NO_DATA: 'saveFile 必须提供 buffer 或 stream',
  /** 禁止访问本地地址（taskApi validateImageUrl） */
  LOCAL_ADDRESS_BLOCKED: '禁止访问本地地址',
  /** 禁止访问私有IP地址（taskApi validateImageUrl） */
  PRIVATE_IP_BLOCKED: '禁止访问私有IP地址',
  /** 请求过于频繁（taskApi generateAIImage） */
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  /** 签名验证失败（server/index.ts） */
  SIGNATURE_INVALID: '签名验证失败',
} as const;

/** AI 图片生成默认尺寸 */
export const DEFAULT_IMAGE_SIZE = '1024x1024';
/** AI 图片生成默认尺寸（单边像素值） */
export const DEFAULT_IMAGE_DIMENSION = 1024;
/** AI 图片生成支持的服务商列表 */
export const AI_IMAGE_PROVIDERS = ['qwen', 'dalle', 'stability', 'glm'] as const;
/** AI 图片生成服务商类型 */
export type AiImageProvider = (typeof AI_IMAGE_PROVIDERS)[number];

/** 每月近似天数（30天） */
export const DAYS_PER_MONTH_APPROX = 30;

/** 每年天数 */
export const DAYS_PER_YEAR = 365;

/** 代币发放队列任务名称 */
export const QUEUE_NAME_GRANT_TOKENS = 'grantSubscriptionTokens';
