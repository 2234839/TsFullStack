/**
 * Visual Test 服务的 RPC 客户端
 *
 * 直连 visual-test 独立 HTTP 服务（默认 localhost:7890），
 * 使用与 TsFullStack 相同的 superjson + POST 协议。
 *
 * 服务地址可通过 localStorage 的 'visualTestServerUrl' 配置。
 */
import superjson from "superjson";
import type { VisualTestAPI } from "@tsfullstack/visual-test";

/** localStorage key：visual-test 服务地址 */
const STORAGE_KEY = "visualTestServerUrl";

/** 默认服务地址 */
const DEFAULT_SERVER = "http://localhost:7890";

/** 获取当前配置的服务地址 */
export function getServerUrl(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_SERVER;
}

/** 设置服务地址 */
export function setServerUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY, url);
}

/**
 * RPC 响应结构（与 visual-test server.ts 的 sendJson 对齐）
 */
interface RPCResponse<T = unknown> {
  result?: string;
  error?: { message: string };
}

/**
 * 调用 visual-test 服务的方法
 *
 * 将异步 API 接口转换为 Proxy，支持链式调用如 `vt.runAll()`
 */
export function createVisualTestRPC(serverUrl: string = getServerUrl()): VisualTestAPI {
  const baseUrl = serverUrl.replace(/\/$/, "");

  async function callMethod(method: string, args: unknown[] = []): Promise<unknown> {
    const url = `${baseUrl}/api/${method}`;
    const body = superjson.stringify(args);

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body,
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
    }

    const json: RPCResponse = await resp.json();
    if (json.error) {
      throw new Error(json.error.message);
    }
    if (json.result === undefined) {
      return undefined;
    }
    return superjson.parse(json.result);
  }

  /**
   * 健康检查
   */
  async function health(): Promise<{ status: string; env: string } | null> {
    try {
      const resp = await fetch(`${baseUrl}/health`);
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }

  return new Proxy({} as VisualTestAPI, {
    get(_target, prop: string) {
      if (prop === "health") return health;
      return (...args: unknown[]) => callMethod(prop, args);
    },
  });
}

/** 默认 RPC 实例 */
export const vt = createVisualTestRPC();
