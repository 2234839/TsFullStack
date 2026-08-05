/**
 * visual-test 的 API 接口定义
 *
 * 这些函数会被 createRPC('apiProvider') 包装，
 * 前端审批页面通过 createRPC('apiConsumer') 调用。
 *
 * 设计原则：
 * - 不依赖 TsFullStack 后端的数据库/认证系统
 * - 独立运行，由 visual-test 进程提供 HTTP 服务
 * - 但使用与 TsFullStack 相同的 RPC 协议（superjson + POST /api/method）
 */
import type { RunReport, ScenarioResult, Manifest, TestEnv } from "./types";

/**
 * visual-test API 接口
 * 前端通过 RPC 代理调用这些方法
 */
export interface VisualTestAPI {
  /** 健康检查，返回服务状态和当前环境 */
  health(): Promise<{ status: string; env: string } | null>;

  /** 获取所有场景的当前运行结果 */
  getResults(): Promise<{ report: RunReport | null; manifest: Manifest | null }>;

  /** 运行所有测试场景（触发新一轮截图+对比） */
  runAll(): Promise<RunReport>;

  /** 运行单个场景 */
  runOne(name: string): Promise<ScenarioResult>;

  /** 批准一个场景的当前截图为基准 */
  approve(name: string): Promise<{ success: boolean }>;

  /** 批准所有待审批的场景 */
  approveAll(): Promise<{ approved: string[] }>;

  /** 拒绝一个场景 */
  reject(name: string): Promise<{ success: boolean }>;

  /** 获取当前环境配置 */
  getConfig(): Promise<{
    env: TestEnv;
    baseUrl: string;
    scenarios: Array<{ name: string; path: string; envs?: TestEnv[] }>;
  }>;

  /** 切换测试环境 */
  setEnv(env: TestEnv): Promise<{ success: boolean }>;

  /** 获取图片的 base64（供前端展示） */
  getImage(type: "baseline" | "current" | "diff", name: string): Promise<string | null>;

  /** 获取 DOM 结构 JSON */
  getDom(type: "baseline" | "current", name: string): Promise<string | null>;
}
