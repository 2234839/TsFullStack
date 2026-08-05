/**
 * 轻量 HTTP 服务，兼容 TsFullStack RPC 协议
 *
 * 接收 POST /api/method 请求，用 superjson 反序列化参数，
 * 调用 VisualTestAPI 实现，返回 superjson 序列化的结果。
 *
 * 同时提供静态文件服务（图片资源）。
 */
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { readFileSync, existsSync } from "fs";
import superjson from "superjson";
import type { RunConfig, RunReport, TestEnv } from "./types";
import { runTests, approveScenario, rejectScenario } from "./runner";
import { loadManifest, getBaselinePaths, getCurrentPaths } from "./comparator";
import type { VisualTestAPI } from "./api";

interface ServerOptions {
  /** 监听端口 */
  port: number;
  /** 监听地址 */
  host?: string;
  /** 运行配置（由 CLI 传入） */
  runConfig: RunConfig;
}

/**
 * 创建 VisualTestAPI 的实现
 */
function createApiImpl(runConfig: RunConfig): VisualTestAPI {
  let latestReport: RunReport | null = null;

  return {
    async health() {
      return { status: "ok", env: runConfig.env };
    },

    async getResults() {
      const manifest = loadManifest(runConfig.baselineDir, runConfig.env);
      return { report: latestReport, manifest };
    },

    async runAll() {
      const report = await runTests(runConfig);
      latestReport = report;
      return report;
    },

    async runOne(name: string) {
      const fullReport = await runTests({
        ...runConfig,
        scenarios: runConfig.scenarios.filter((s) => s.name === name),
      });
      const result = fullReport.results[0];
      if (!result) throw new Error(`场景 ${name} 未找到`);
      // 更新 latestReport 中该场景的结果
      if (latestReport) {
        const idx = latestReport.results.findIndex((r) => r.name === name);
        if (idx >= 0) latestReport.results[idx] = result;
        else latestReport.results.push(result);
      }
      return result;
    },

    async approve(name: string) {
      const scenario = runConfig.scenarios.find((s) => s.name === name);
      if (!scenario) throw new Error(`场景 ${name} 未找到`);
      approveScenario(
        runConfig.baselineDir,
        runConfig.outputDir,
        name,
        "web-ui",
        runConfig.env,
        scenario.skipPixel ?? false,
      );
      /** 同步更新 latestReport 中的场景状态 */
      if (latestReport) {
        const r = latestReport.results.find((it) => it.name === name);
        if (r) r.status = "approved";
      }
      return { success: true };
    },

    async approveAll() {
      if (!latestReport) throw new Error("请先运行测试");
      const approved: string[] = [];
      for (const result of latestReport.results) {
        if (result.status === "pendingNew" || result.status === "pendingDiff") {
          const scenario = runConfig.scenarios.find((s) => s.name === result.name);
          if (!scenario) continue;
          approveScenario(
            runConfig.baselineDir,
            runConfig.outputDir,
            result.name,
            "web-ui",
            runConfig.env,
            scenario.skipPixel ?? false,
          );
          result.status = "approved";
          approved.push(result.name);
        }
      }
      return { approved };
    },

    async reject(name: string) {
      rejectScenario(runConfig.baselineDir, name, runConfig.env);
      /** 同步更新 latestReport 中的场景状态 */
      if (latestReport) {
        const r = latestReport.results.find((it) => it.name === name);
        if (r) r.status = "rejected";
      }
      return { success: true };
    },

    async getConfig() {
      return {
        env: runConfig.env,
        baseUrl: runConfig.baseUrl,
        scenarios: runConfig.scenarios.map((s) => ({
          name: s.name,
          path: s.path,
          envs: s.envs,
        })),
      };
    },

    async setEnv(env: TestEnv) {
      runConfig.env = env;
      return { success: true };
    },

    async getImage(type: "baseline" | "current" | "diff", name: string) {
      let filePath: string;
      if (type === "baseline") {
        filePath = getBaselinePaths(runConfig.baselineDir, name, runConfig.env).image;
      } else if (type === "current") {
        filePath = getCurrentPaths(runConfig.outputDir, name).image;
      } else {
        filePath = getCurrentPaths(runConfig.outputDir, name).diff;
      }
      if (!existsSync(filePath)) return null;
      const buffer = readFileSync(filePath);
      return buffer.toString("base64");
    },

    async getDom(type: "baseline" | "current", name: string) {
      let filePath: string;
      if (type === "baseline") {
        filePath = getBaselinePaths(runConfig.baselineDir, name, runConfig.env).dom;
      } else {
        filePath = getCurrentPaths(runConfig.outputDir, name).dom;
      }
      if (!existsSync(filePath)) return null;
      return readFileSync(filePath, "utf-8");
    },
  };
}

/**
 * 启动 HTTP 服务
 */
export function startServer(options: ServerOptions): void {
  const { port, host = "localhost", runConfig } = options;
  const api = createApiImpl(runConfig);

  const server = createServer(async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url ?? "";

    // RPC 路由：POST /api/method → 调用 api[method](...args)
    if (req.method === "POST" && url.startsWith("/api/")) {
      const method = url.replace("/api/", "");
      try {
        const body = await readBody(req);
        const parsed = body ? superjson.parse(body) : [];
        const args = Array.isArray(parsed) ? parsed : [parsed];
        const methodKey = method as keyof VisualTestAPI;
        if (typeof api[methodKey] !== "function") {
          sendJson(res, 404, { error: { message: `方法 ${method} 不存在` } });
          return;
        }
        const result = await (api[methodKey] as (...a: unknown[]) => unknown)(...args);
        sendJson(res, 200, { result: superjson.stringify(result) });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        sendJson(res, 200, { error: { message } });
      }
      return;
    }

    // 健康检查
    if (url === "/health") {
      sendJson(res, 200, { status: "ok", env: runConfig.env });
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  server.listen(port, host, () => {
    console.log(`Visual Test 服务已启动: http://${host}:${port}`);
    console.log(`  环境: ${runConfig.env}`);
    console.log(`  目标: ${runConfig.baseUrl}`);
    console.log(`  前端审批页面连接地址: http://${host}:${port}/api/`);
  });
}

/** 读取请求 body */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

/** 发送 JSON 响应 */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
