/** 时间常量（毫秒单位） */
export const MS_PER_SECOND = 1000;
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

/** 外部 API 超时（毫秒） */
export const GITHUB_FETCH_TIMEOUT_MS = 15_000;
export const IMAGE_DOWNLOAD_TIMEOUT_MS = 30_000;
export const AI_IMAGE_API_TIMEOUT_MS = 60_000;
export const OPENAI_PROXY_TIMEOUT_MS = 120_000;
export const OLLAMA_API_TIMEOUT_MS = 60_000;

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
} as const;
