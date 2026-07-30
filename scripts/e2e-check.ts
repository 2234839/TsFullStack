/**
 * TsFullStack 线上端到端测试
 *
 * 部署后自动执行，通过 Playwright 实际操作浏览器：
 * - 登录
 * - 管理后台各页面切换
 * - 数据工作室数据加载验证
 * - 控制台错误检测
 *
 * 用法:
 *   npx tsx scripts/e2e-check.ts
 *
 * 环境变量（可写入 .deploy-env）:
 *   E2E_BASE_URL  - 测试地址（必填）
 *   E2E_EMAIL     - 登录邮箱（必填）
 *   E2E_PASSWORD  - 登录密码（必填）
 *   E2E_LOGIN_EXPECT - 预期登录后跳转的 URL 片段（默认 BASE_URL）
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { chromium } from "playwright";

/** 从 .deploy-env 加载环境变量 */
function loadDeployEnv() {
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
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .deploy-env 不存在，跳过
  }
}
loadDeployEnv();

const BASE_URL = process.env.E2E_BASE_URL || "";
const EMAIL = process.env.E2E_EMAIL || "";
/** 测试账号密码，必须通过环境变量传入 */
const PASSWORD = process.env.E2E_PASSWORD || "";

if (!BASE_URL || !EMAIL || !PASSWORD) {
  console.error("❌ 请设置 E2E_BASE_URL, E2E_EMAIL, E2E_PASSWORD 环境变量");
  console.error("   可写入项目根目录 .deploy-env 文件，或直接 export");
  process.exit(1);
}

/** 测试结果 */
const results: { name: string; ok: boolean; detail?: string }[] = [];

function record(name: string, ok: boolean, detail?: string) {
  const icon = ok ? "✅" : "❌";
  const line = detail ? `  ${icon} ${name} — ${detail}` : `  ${icon} ${name}`;
  console.log(line);
  results.push({ name, ok, detail });
}

async function main() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  TsFullStack 端到端测试 (Playwright)");
  console.log(`  ${BASE_URL}`);
  console.log("═══════════════════════════════════════════════\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  /** 收集控制台错误和页面异常 */
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      /** 忽略已知的无害错误 */
      if (!text.includes("ResizeObserver") && !text.includes("ERR_INCOMPLETE_CHUNKED_ENCODING")) {
        consoleErrors.push(text);
      }
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`[PAGE_ERROR] ${err.message}`);
  });

  // ── 1. 登录测试 ─────────────────────────
  console.log("[1/4] 登录测试");

  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.fill('input[placeholder="请输入用户名"]', EMAIL);
  await page.fill('input[placeholder="请输入密码"]', PASSWORD);
  await page.click('button:has-text("登录")');

  /** 等待登录完成（跳转回首页或出现 toast） */
  try {
    await page.waitForURL(BASE_URL + "/", { timeout: 15000 });
    record("登录", true, `已跳转到 ${page.url()}`);
  } catch {
    /** 检查是否有 toast 提示登录成功 */
    const toast = await page
      .locator("text=登录成功")
      .count()
      .catch(() => 0);
    if (toast > 0) {
      record("登录", true, "显示登录成功提示");
    } else {
      record("登录", false, `未跳转且无成功提示，当前 URL: ${page.url()}`);
    }
  }
  await page.waitForTimeout(1000);

  // ── 2. 管理后台页面切换 ─────────────────
  console.log("\n[2/4] 管理后台页面切换");

  /** 要测试的页面路由 */
  const adminPages: { path: string; label: string; expectText?: string }[] = [
    { path: "/admin", label: "仪表盘", expectText: "TsFullStack" },
    { path: "/admin/studio", label: "数据工作室", expectText: "数据工作室" },
    { path: "/admin/UploadList", label: "上传列表", expectText: "文件" },
    { path: "/admin/ShareList", label: "分享管理", expectText: "分享" },
    { path: "/admin/resourceGallery", label: "资源库" },
    { path: "/admin/PaymentConfig", label: "支付配置" },
  ];

  for (const p of adminPages) {
    await page.goto(`${BASE_URL}${p.path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);

    const title = await page.title();
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));

    /** 验证页面标题包含预期文字 */
    const hasExpected = !p.expectText || bodyText.includes(p.expectText);
    /** 验证不是空白页（body 有实际内容） */
    const notBlank = bodyText.trim().length > 50;

    record(p.label, hasExpected && notBlank, `title="${title}" url=${p.path}`);
  }

  // ── 3. 数据工作室数据加载 ───────────────
  console.log("\n[3/4] 数据工作室数据加载");

  await page.goto(`${BASE_URL}/admin/studio?modelName=User`, {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  await page.waitForTimeout(5000);

  /** 检查是否出现数据表格 */
  const hasTable = await page.locator("table").count();
  const hasUserData = await page
    .locator(`text=${EMAIL}`)
    .count()
    .catch(() => 0);

  if (hasTable > 0 && hasUserData > 0) {
    record("User 数据加载", true, "表格存在且包含 admin 用户");
  } else if (hasTable > 0) {
    record("User 数据加载", true, "表格已渲染（用户数据可能需要滚动）");
  } else {
    record("User 数据加载", false, "未找到数据表格");
  }

  // ── 4. 前台页面 ─────────────────────────
  console.log("\n[4/4] 前台页面");

  const publicPages: { path: string; label: string; expectText?: string }[] = [
    { path: "/", label: "首页", expectText: "NoteCalc" },
    { path: "/noteCalc", label: "NoteCalc 在线计算" },
  ];

  for (const p of publicPages) {
    await page.goto(`${BASE_URL}${p.path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    const hasExpected = !p.expectText || bodyText.includes(p.expectText);
    record(p.label, hasExpected);
  }

  // ── 控制台错误检查 ──────────────────────
  console.log("\n[检查] 控制台错误");
  if (consoleErrors.length === 0) {
    record("控制台无异常错误", true);
  } else {
    record(
      "控制台错误",
      false,
      `${consoleErrors.length} 条: ${consoleErrors.slice(0, 3).join("; ")}`,
    );
  }

  await browser.close();

  // ── 汇总 ────────────────────────────────
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  console.log("\n═══════════════════════════════════════════════");
  console.log(`  ✅ 通过: ${passed}  ❌ 失败: ${failed}`);
  console.log("═══════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("测试脚本异常:", err);
  process.exit(1);
});
