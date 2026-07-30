#!/usr/bin/env node
/**
 * visual-test CLI 入口
 *
 * 用法:
 *   # 启动测试服务（含 HTTP API 供前端审批页面调用）
 *   npx tsx packages/visual-test/src/cli.ts serve --port 7890 --env production
 *
 *   # 本地开发环境
 *   npx tsx packages/visual-test/src/cli.ts serve --env local
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { startServer } from "./server";
import type { RunConfig, Scenario, TestEnv } from "./types";

/** 解析命令行参数 */
function parseArgs(): {
  command: string;
  port: number;
  env: TestEnv;
  baseUrl: string;
  configPath: string;
} {
  const args = process.argv.slice(2);
  const command = args[0] ?? "serve";

  const getArg = (key: string, defaultValue?: string): string | undefined => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] : defaultValue;
  };

  // 从 .deploy-env 读取默认值
  const deployEnv = loadDeployEnv();

  const port = parseInt(getArg("port", "7890")!, 10);
  const env = getArg("env", "local") as TestEnv;
  const baseUrl = getArg(
    "baseUrl",
    env === "production" ? deployEnv.E2E_BASE_URL : "http://localhost:5173",
  )!;
  const configPath = getArg("config", "visual-test.config.json")!;

  return { command, port, env, baseUrl, configPath };
}

/** 加载 .deploy-env */
function loadDeployEnv(): Record<string, string> {
  const result: Record<string, string> = {};
  const envPath = resolve(process.cwd(), ".deploy-env");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      result[key] = val;
    }
  } catch {
    // .deploy-env 不存在
  }
  return result;
}

/** 加载场景配置 */
function loadScenarios(configPath: string): Scenario[] {
  const fullPath = resolve(process.cwd(), configPath);
  try {
    const content = readFileSync(fullPath, "utf-8");
    const config = JSON.parse(content);
    return config.scenarios ?? [];
  } catch {
    // 返回默认场景
    return getDefaultScenarios();
  }
}

/** 默认测试场景 */
function getDefaultScenarios(): Scenario[] {
  return [
    {
      name: "login",
      path: "/login",
      description: "登录页",
      envs: ["local", "production"],
    },
    {
      name: "home",
      path: "/",
      description: "首页",
      envs: ["local", "production"],
    },
    {
      name: "noteCalc",
      path: "/noteCalc",
      description: "计算笔记本",
      envs: ["local", "production"],
      freezeSelectors: [".cm-content"],
    },
    {
      name: "admin-dashboard",
      path: "/admin",
      description: "管理后台 - 仪表盘",
      loginRequired: true,
      envs: ["local", "production"],
    },
    {
      name: "admin-studio",
      path: "/admin/studio",
      description: "管理后台 - 数据工作室",
      loginRequired: true,
      envs: ["local", "production"],
      skipPixel: true, // 数据表格内容高度动态，只验证 DOM 结构
    },
  ];
}

async function main() {
  const opts = parseArgs();

  if (opts.command === "serve") {
    const scenarios = loadScenarios(opts.configPath);
    const deployEnv = loadDeployEnv();

    const runConfig: RunConfig = {
      baselineDir: resolve(process.cwd(), "visual-test-baselines"),
      outputDir: resolve(process.cwd(), "visual-test-output"),
      scenarios,
      baseUrl: opts.baseUrl,
      env: opts.env,
      login:
        deployEnv.E2E_EMAIL && deployEnv.E2E_PASSWORD
          ? {
              email: deployEnv.E2E_EMAIL,
              password: deployEnv.E2E_PASSWORD,
            }
          : undefined,
      defaultViewport: { width: 1280, height: 720 },
    };

    console.log("═══════════════════════════════════════════");
    console.log("  Visual Test 服务");
    console.log("═══════════════════════════════════════════");
    console.log(`  环境: ${opts.env}`);
    console.log(`  目标: ${opts.baseUrl}`);
    console.log(`  场景: ${scenarios.length} 个`);
    console.log(`  端口: ${opts.port}`);
    console.log("");

    startServer({
      port: opts.port,
      runConfig,
    });
  } else {
    console.error(`未知命令: ${opts.command}`);
    console.error(
      "用法: visual-test serve [--port 7890] [--env local|production] [--baseUrl http://...]",
    );
    process.exit(1);
  }
}

main();
