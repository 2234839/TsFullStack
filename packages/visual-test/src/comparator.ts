/**
 * 像素对比 + manifest 管理
 */
import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { PNG, type PNGWithMetadata } from "pngjs";
import pixelmatch from "pixelmatch";
import type { Manifest, ManifestEntry, ScenarioResult, TestEnv } from "./types";
import { diffDomJson } from "./dom-serializer";

/**
 * 读取 manifest.json，不存在则返回空结构
 * manifest 按环境分开存放（像素基准的审批状态随环境不同）
 */
export function loadManifest(baselineDir: string, env: TestEnv): Manifest {
  const manifestPath = join(baselineDir, env, "manifest.json");
  if (!existsSync(manifestPath)) {
    return { version: 1, scenarios: {} };
  }
  try {
    return JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch {
    return { version: 1, scenarios: {} };
  }
}

/**
 * 保存 manifest.json（按环境）
 */
export function saveManifest(baselineDir: string, env: TestEnv, manifest: Manifest): void {
  const manifestPath = join(baselineDir, env, "manifest.json");
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * 计算内容的 hash（用于快速判断是否变化）
 */
export function contentHash(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * 对比两张 PNG 图片，返回差异百分比（0~100）
 */
export function compareImages(
  baselinePath: string,
  currentPath: string,
  diffPath: string,
): { diffPercent: number; diffPixels: number } {
  const img1 = PNG.sync.read(readFileSync(baselinePath));
  const img2 = PNG.sync.read(readFileSync(currentPath));

  const width = Math.max(img1.width, img2.width);
  const height = Math.max(img1.height, img2.height);

  // 尺寸不同直接报 100% 差异
  if (img1.width !== img2.width || img1.height !== img2.height) {
    return { diffPercent: 100, diffPixels: width * height };
  }

  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(
    img1.data as Buffer,
    img2.data as Buffer,
    diff.data,
    width,
    height,
    { threshold: 0.1 },
  );

  // 保存 diff 图
  mkdirSync(dirname(diffPath), { recursive: true });
  writeFileSync(diffPath, PNG.sync.write(diff));

  const totalPixels = width * height;
  const diffPercent = (diffPixels / totalPixels) * 100;

  return { diffPercent, diffPixels };
}

/**
 * 对比 DOM 结构
 */
export function compareDom(
  baselineDomJson: string,
  currentDomJson: string,
): { identical: boolean; diff?: string } {
  return diffDomJson(baselineDomJson, currentDomJson);
}

/**
 * 判断场景结果状态
 */
export function determineStatus(
  manifestEntry: ManifestEntry | undefined,
  domIdentical: boolean,
  pixelDiffPercent: number | null,
  threshold: number,
): ScenarioResult["status"] {
  // 无基准 → 待审批新建
  if (!manifestEntry || manifestEntry.status === "pendingNew") {
    return "pendingNew";
  }

  // 已拒绝 → 保持拒绝
  if (manifestEntry.status === "rejected") {
    return "rejected";
  }

  // 已批准的基准，对比结果
  const domPassed = domIdentical;
  const pixelPassed = pixelDiffPercent === null || pixelDiffPercent <= threshold;

  if (domPassed && pixelPassed) {
    return "approved";
  }

  // 有差异 → 待审批变更
  return "pendingDiff";
}

/**
 * 获取场景的基准文件路径
 * 像素基准按环境分开（数据不同），DOM 基准共用（结构相同）
 */
export function getBaselinePaths(baselineDir: string, scenarioName: string, env: TestEnv) {
  return {
    /** 像素基准：按环境分目录 */
    image: join(baselineDir, env, `${scenarioName}.png`),
    /** DOM 结构基准：环境无关，放 shared 目录 */
    dom: join(baselineDir, "shared", `${scenarioName}.dom.json`),
  };
}

/**
 * 获取场景的当前运行文件路径
 */
export function getCurrentPaths(outputDir: string, scenarioName: string) {
  return {
    dom: join(outputDir, `${scenarioName}.dom.json`),
    image: join(outputDir, `${scenarioName}.png`),
    diff: join(outputDir, `${scenarioName}.diff.png`),
  };
}
