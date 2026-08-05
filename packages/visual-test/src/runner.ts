/**
 * 测试运行器：用 Playwright 打开页面、截图、对比
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import type { RunConfig, Scenario, ScenarioResult, RunReport, Manifest, TestEnv } from "./types";
import {
  loadManifest,
  saveManifest,
  contentHash,
  compareImages,
  compareDom,
  determineStatus,
  getBaselinePaths,
  getCurrentPaths,
} from "./comparator";
/**
 * 浏览器上下文中执行的 DOM 序列化代码（IIFE 字符串，避免 tsx __name 污染）
 *
 * page.evaluate 接收字符串时直接 eval 为表达式，
 * 用 IIFE 形式 (function(){...})() 立即执行并返回结果。
 */
const SERIALIZE_DOM_CODE = `(function () {
  const IGNORE_TAGS = new Set(['script', 'style', 'link', 'meta', 'noscript', 'svg', 'path']);
  const KEEP_ATTRS = new Set(['class', 'id', 'role', 'aria-label', 'aria-hidden', 'data-test', 'type', 'href', 'placeholder', 'disabled', 'checked', 'selected', 'colspan', 'rowspan', 'target', 'rel']);

  function walk(el) {
    const tag = el.tagName.toLowerCase();
    if (IGNORE_TAGS.has(tag)) return null;
    const style = window.getComputedStyle(el);
    if (style.display === 'none') return null;

    const node = { tag };

    if (el.className && typeof el.className === 'string') {
      const cls = el.className.split(/\\s+/).filter(c => c && !c.startsWith('data-v-')).sort();
      if (cls.length > 0) node.class = cls;
    }

    const attrs = {};
    for (const attr of Array.from(el.attributes)) {
      if (KEEP_ATTRS.has(attr.name)) attrs[attr.name] = attr.value;
    }
    if (Object.keys(attrs).length > 0) node.attrs = attrs;

    const children = [];
    for (const child of Array.from(el.children)) {
      const s = walk(child);
      if (s) children.push(s);
    }
    if (children.length > 0) node.children = children;

    return node;
  }

  if (!document.body) return '{}';
  return JSON.stringify(walk(document.body), null, 2);
})()`;

/**
 * 运行所有场景，生成 RunReport
 * 根据 config.env 过滤适用环境的场景
 */
export async function runTests(config: RunConfig): Promise<RunReport> {
  mkdirSync(config.outputDir, { recursive: true });
  const manifest = loadManifest(config.baselineDir, config.env);

  // 过滤出适用当前环境的场景
  const applicableScenarios = config.scenarios.filter(
    (s) => !s.envs || s.envs.includes(config.env),
  );

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
  const results: ScenarioResult[] = [];

  // 如果需要登录，先登录
  let page: import("playwright").Page | undefined;
  let loggedIn = false;

  for (const scenario of applicableScenarios) {
    if (scenario.loginRequired && !loggedIn && config.login) {
      page = await loginAndCreatePage(browser, config);
      loggedIn = true;
    } else if (!page) {
      page = await browser.newPage({
        viewport: scenario.viewportWidth
          ? { width: scenario.viewportWidth, height: scenario.viewportHeight ?? 720 }
          : config.defaultViewport,
      });
    }

    const result = await runScenario(page, scenario, config, manifest);
    results.push(result);
  }

  await browser.close();

  return buildReport(results);
}

/**
 * 登录并返回已认证的 page
 */
async function loginAndCreatePage(browser: Browser, config: RunConfig): Promise<Page> {
  const page = await browser.newPage({
    viewport: config.defaultViewport,
  });

  const loginPath = config.login?.loginPath ?? "/login";
  await page.goto(`${config.baseUrl}${loginPath}`, { waitUntil: "networkidle", timeout: 30000 });

  await page.fill('input[placeholder="请输入用户名"]', config.login!.email);
  await page.fill('input[placeholder="请输入密码"]', config.login!.password);
  await page.click('button:has-text("登录")');

  // 等待跳转
  try {
    await page.waitForURL(config.baseUrl + "/", { timeout: 15000 });
  } catch {
    // 某些情况下可能只是 toast 提示
  }
  await page.waitForTimeout(1000);

  return page;
}

/**
 * 运行单个场景
 */
async function runScenario(
  page: Page,
  scenario: Scenario,
  config: RunConfig,
  manifest: Manifest,
): Promise<ScenarioResult> {
  const startTime = Date.now();
  const threshold = scenario.threshold ?? 0.1;

  try {
    // 设置视口
    if (scenario.viewportWidth) {
      await page.setViewportSize({
        width: scenario.viewportWidth,
        height: scenario.viewportHeight ?? 720,
      });
    }

    // 导航
    await page.goto(`${config.baseUrl}${scenario.path}`, {
      waitUntil: "commit",
      timeout: 15000,
    });

    // 等待渲染稳定
    const waitTime = scenario.waitBeforeScreenshot ?? 3000;
    await page.waitForTimeout(waitTime);

    // 截图前处理：隐藏动态元素
    if (scenario.hideSelectors?.length) {
      await page.addStyleTag({
        content: scenario.hideSelectors
          .map((s) => `${s} { visibility: hidden !important; }`)
          .join("\n"),
      });
    }

    // 截图前处理：冻结文字内容
    if (scenario.freezeSelectors?.length) {
      await page.evaluate((selectors) => {
        for (const sel of selectors) {
          document.querySelectorAll(sel).forEach((el) => {
            const text = el.textContent ?? "";
            el.textContent = "█".repeat(Math.max(text.length, 3));
          });
        }
      }, scenario.freezeSelectors);
    }

    // 自定义 beforeScreenshot 脚本
    if (scenario.beforeScreenshot) {
      await page.evaluate(scenario.beforeScreenshot);
    }

    const currentPaths = getCurrentPaths(config.outputDir, scenario.name);
    mkdirSync(config.outputDir, { recursive: true });

    // 1. 截图（像素）— skipPixel 场景跳过。截图失败不阻塞 DOM 序列化
    let screenshotError: string | undefined;
    if (!scenario.skipPixel) {
      try {
        if (scenario.clipSelector) {
          const element = await page.$(scenario.clipSelector);
          if (element) {
            await element.screenshot({ path: currentPaths.image, timeout: 20000 });
          } else {
            throw new Error(`clipSelector "${scenario.clipSelector}" 未找到元素`);
          }
        } else {
          await page.screenshot({
            path: currentPaths.image,
            fullPage: true,
            timeout: 20000,
            animations: "disabled",
          });
        }
      } catch (e) {
        screenshotError = e instanceof Error ? e.message : String(e);
      }
    }

    // 2. DOM 序列化（IIFE 字符串注入，避免 tsx __name 污染）
    const domJson = (await page.evaluate(SERIALIZE_DOM_CODE)) as string;
    writeFileSync(currentPaths.dom, domJson);

    // 3. 对比
    const baselinePaths = getBaselinePaths(config.baselineDir, scenario.name, config.env);
    const manifestEntry = manifest.scenarios[scenario.name];

    let domIdentical = true;
    let domDiff: string | undefined;
    let pixelDiffPercent: number | null = null;

    // DOM 对比
    if (existsSync(baselinePaths.dom)) {
      const baselineDom = readFileSync(baselinePaths.dom, "utf-8");
      const domResult = compareDom(baselineDom, domJson);
      domIdentical = domResult.identical;
      domDiff = domResult.diff;
    } else {
      domIdentical = false; // 无基准
    }

    // 像素对比（skipPixel 场景不做）
    if (!scenario.skipPixel && existsSync(baselinePaths.image)) {
      const imgResult = compareImages(baselinePaths.image, currentPaths.image, currentPaths.diff);
      pixelDiffPercent = imgResult.diffPercent;
    }

    const status = determineStatus(manifestEntry, domIdentical, pixelDiffPercent, threshold);

    return {
      name: scenario.name,
      status,
      domPassed: domIdentical,
      pixelDiffPercent,
      domDiff,
      error: screenshotError,
      currentScreenshot: currentPaths.image,
      baselineScreenshot: existsSync(baselinePaths.image) ? baselinePaths.image : undefined,
      diffImage: existsSync(currentPaths.diff) ? currentPaths.diff : undefined,
      duration: Date.now() - startTime,
    };
  } catch (err) {
    return {
      name: scenario.name,
      status: "error",
      domPassed: false,
      pixelDiffPercent: null,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * 批准一个场景：将当前截图提升为基准
 */
export function approveScenario(
  baselineDir: string,
  outputDir: string,
  scenarioName: string,
  approvedBy: string,
  env: TestEnv,
  skipPixel: boolean,
  commit?: string,
): void {
  const manifest = loadManifest(baselineDir, env);
  const currentPaths = getCurrentPaths(outputDir, scenarioName);
  const baselinePaths = getBaselinePaths(baselineDir, scenarioName, env);

  mkdirSync(baselineDir, { recursive: true });

  // 复制当前截图 → 基准（像素按环境，DOM 共用）
  if (!skipPixel && existsSync(currentPaths.image)) {
    mkdirSync(join(baselineDir, env), { recursive: true });
    writeFileSync(baselinePaths.image, readFileSync(currentPaths.image));
  }
  if (existsSync(currentPaths.dom)) {
    mkdirSync(join(baselineDir, "shared"), { recursive: true });
    writeFileSync(baselinePaths.dom, readFileSync(currentPaths.dom));
  }

  // 更新 manifest（按环境）
  const domContent = existsSync(baselinePaths.dom) ? readFileSync(baselinePaths.dom, "utf-8") : "";

  manifest.scenarios[scenarioName] = {
    status: "approved",
    approvedBy,
    approvedAt: new Date().toISOString(),
    commit,
    threshold: manifest.scenarios[scenarioName]?.threshold ?? 0.1,
    domHash: contentHash(domContent),
    imageHash:
      !skipPixel && existsSync(baselinePaths.image)
        ? contentHash(readFileSync(baselinePaths.image))
        : undefined,
  };

  saveManifest(baselineDir, env, manifest);
}

/**
 * 拒绝一个场景
 */
export function rejectScenario(baselineDir: string, scenarioName: string, env: TestEnv): void {
  const manifest = loadManifest(baselineDir, env);
  const existing = manifest.scenarios[scenarioName];

  manifest.scenarios[scenarioName] = {
    ...existing,
    status: "rejected" as const,
    threshold: existing?.threshold ?? 0.1,
    domHash: existing?.domHash ?? "",
  };

  saveManifest(baselineDir, env, manifest);
}

/**
 * 构建运行报告
 */
function buildReport(results: ScenarioResult[]): RunReport {
  const summary = { approved: 0, failed: 0, pendingNew: 0, pendingDiff: 0, rejected: 0, error: 0 };
  for (const r of results) {
    summary[r.status]++;
  }

  return {
    timestamp: new Date().toISOString(),
    total: results.length,
    summary,
    results,
  };
}
