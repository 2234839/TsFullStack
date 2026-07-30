/**
 * 视觉回归测试核心类型定义
 */

/**
 * 测试环境标识
 * - local: 本地开发服务器
 * - production: 线上环境
 */
export type TestEnv = "local" | "production";

/**
 * 单个测试场景的配置
 */
export interface Scenario {
  /** 场景唯一标识，如 "login"、"admin-dashboard" */
  name: string;
  /** 页面路径，如 "/login"、"/admin" */
  path: string;
  /** 场景描述 */
  description?: string;
  /** 视口宽度（px） */
  viewportWidth?: number;
  /** 视口高度（px） */
  viewportHeight?: number;
  /** 需要登录时填写，不填则匿名访问 */
  loginRequired?: boolean;
  /** 像素对比阈值（0~1，差异百分比超过此值则判定为回归） */
  threshold?: number;
  /** 截图前注入的 CSS 选择器列表，匹配的元素会被隐藏（用于消除动态内容） */
  hideSelectors?: string[];
  /** 截图前注入的 CSS 选择器列表，匹配的元素的文字内容会被替换为占位符 */
  freezeSelectors?: string[];
  /** 截图前执行的 JS 函数（在浏览器上下文中运行） */
  beforeScreenshot?: string;
  /** 是否只截某个元素（CSS 选择器），不填则截整页 */
  clipSelector?: string;
  /** 等待时间（ms），等页面渲染稳定后再截图 */
  waitBeforeScreenshot?: number;
  /** 适用环境，不填则所有环境都跑 */
  envs?: TestEnv[];
  /** 是否跳过像素对比（纯 DOM 结构验证场景，如高度动态的数据表格） */
  skipPixel?: boolean;
}

/**
 * 场景运行结果状态
 * - approved: 基准已批准，对比通过
 * - failed: 基准已批准，但对比发现差异
 * - pendingNew: 无基准，等待人工批准首次截图
 * - pendingDiff: 有基准，但发现了差异，等待人工审批是否接受变更
 * - rejected: 人工拒绝了该场景
 * - error: 运行时出错
 */
export type ScenarioStatus =
  | "approved"
  | "failed"
  | "pendingNew"
  | "pendingDiff"
  | "rejected"
  | "error";

/**
 * 单个场景的运行结果
 */
export interface ScenarioResult {
  name: string;
  status: ScenarioStatus;
  /** DOM 结构是否通过（JSON 快照对比） */
  domPassed: boolean;
  /** 像素差异百分比（0~100），没有像素基准时为 null */
  pixelDiffPercent: number | null;
  /** DOM 结构差异描述 */
  domDiff?: string;
  /** 截图文件路径（相对于 outputDir） */
  currentScreenshot?: string;
  /** 基准截图路径 */
  baselineScreenshot?: string;
  /** diff 图路径 */
  diffImage?: string;
  /** 错误信息 */
  error?: string;
  /** 运行耗时（ms） */
  duration: number;
}

/**
 * manifest.json 中记录的单个场景审批信息
 */
export interface ManifestEntry {
  /** 审批状态 */
  status: ScenarioStatus;
  /** 批准者 */
  approvedBy?: string;
  /** 批准时间（ISO 8601） */
  approvedAt?: string;
  /** 批准时的 git commit hash */
  commit?: string;
  /** 像素对比阈值 */
  threshold: number;
  /** DOM 结构 JSON 的内容 hash（用于快速判断结构是否变化） */
  domHash: string;
  /** 像素基准图片的 hash */
  imageHash?: string;
}

/**
 * manifest.json 的完整结构
 */
export interface Manifest {
  /** manifest 版本 */
  version: number;
  /** 各场景的审批记录 */
  scenarios: Record<string, ManifestEntry>;
}

/**
 * 运行测试的配置
 */
export interface RunConfig {
  /** 基准根目录（内部会按环境分子目录） */
  baselineDir: string;
  /** 当前运行输出目录（当前截图、diff 图） */
  outputDir: string;
  /** 测试场景列表 */
  scenarios: Scenario[];
  /** 浏览器类型 */
  browser?: "chromium" | "firefox" | "webkit";
  /** 基础 URL */
  baseUrl: string;
  /** 当前测试环境 */
  env: TestEnv;
  /** 登录凭据 */
  login?: {
    email: string;
    password: string;
    /** 登录页路径 */
    loginPath?: string;
    /** 登录成功后预期的 URL 片段 */
    expectedUrlAfterLogin?: string;
  };
  /** 默认视口 */
  defaultViewport?: { width: number; height: number };
}

/**
 * 完整运行报告
 */
export interface RunReport {
  /** 运行时间 */
  timestamp: string;
  /** 总场景数 */
  total: number;
  /** 各状态数量统计 */
  summary: {
    approved: number;
    failed: number;
    pendingNew: number;
    pendingDiff: number;
    rejected: number;
    error: number;
  };
  /** 各场景结果 */
  results: ScenarioResult[];
}
