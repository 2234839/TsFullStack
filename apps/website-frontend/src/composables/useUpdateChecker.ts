/**
 * 更新检测器：双重机制保障 SPA 热更新体验。
 *
 * 1. **主动轮询**：定时 fetch index.html，对比入口 script hash，发现更新弹 toast 提示用户主动刷新。
 * 2. **被动兜底**：导出 isUpdateAvailable 状态 + handleChunkLoadError，供 router.onError 在
 *    chunk 加载失败时调用——如果已知有更新，直接静默 reload；如果未知，先快速检测一次再决定。
 *
 * 原理：Vite 构建产物是 hash 命名（如 index-BN0u034N.js），每次部署 hash 必变。
 * 零后端改动，纯客户端实现。
 */
import { ref } from "vue";

/** 轮询间隔（5 分钟） */
const POLL_INTERVAL = 5 * 60 * 1000;

/** index.html 轮询时的 cache-busting 查询参数 */
const CACHE_BUST_QUERY = "?t=";

/** 模块级状态：是否检测到更新（轮询和路由兜底共享） */
export const isUpdateAvailable = ref(false);

/** 是否已经弹过提示（避免重复弹窗） */
let isNotified = false;

/**
 * 从 HTML 文本中提取入口 script 的 src
 * 入口 script 的特征：src 包含 `/src/main`（dev）或 `/assets/index-`（build）
 * 排除 head 中的 devtools / vite-client 等 module script
 */
function extractEntrySrc(html: string): string | null {
  const matches = [...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)];
  /** 找到真正的入口（不是 devtools / vite-client） */
  const entry = matches.find((m) => m[1].includes("/src/main") || m[1].includes("/assets/index-"));
  return entry ? entry[1] : null;
}

/**
 * 获取当前页面已加载的入口 script src
 * 入口 script 的特征：src 包含 `/src/main`（dev）或 `/assets/index-`（build）
 */
function getCurrentEntry(): string | null {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]');
  for (const script of scripts) {
    const src = script.src.replace(window.location.origin, "");
    if (src.includes("/src/main") || src.includes("/assets/index-")) {
      return src;
    }
  }
  return null;
}

/**
 * fetch index.html（带时间戳防缓存），对比入口 script hash
 * @returns true 表示有新版本
 */
export async function checkUpdate(): Promise<boolean> {
  try {
    const res = await fetch(CACHE_BUST_QUERY + Date.now(), {
      headers: { Accept: "text/html" },
    });
    if (!res.ok) return false;

    const html = await res.text();
    const latestEntry = extractEntrySrc(html);
    const currentEntry = getCurrentEntry();

    if (!latestEntry || !currentEntry) return false;

    return latestEntry !== currentEntry;
  } catch {
    /** 网络错误等，静默忽略 */
    return false;
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * 启动更新检测轮询
 * @param onUpdate 检测到更新时的回调（通常弹 toast 提示用户）
 */
export function startUpdatePolling(onUpdate?: () => void) {
  if (timer) return;

  async function tick() {
    if (document.hidden || isNotified) return;

    const updated = await checkUpdate();
    if (updated) {
      isNotified = true;
      isUpdateAvailable.value = true;
      onUpdate?.();
    }
  }

  /** 首次延迟 1 分钟检查（避免页面刚加载就弹） */
  setTimeout(tick, 60 * 1000);
  timer = setInterval(tick, POLL_INTERVAL);
}

/**
 * 判断 chunk 加载失败是否因为系统更新
 * 供 router.onError 调用：已知有更新就静默 reload，否则快速检测一次再决定
 * @returns true 表示已处理（已触发 reload），false 表示不是更新导致的
 */
export async function handleChunkLoadError(): Promise<boolean> {
  /** 如果轮询已经发现更新，直接 reload */
  if (isUpdateAvailable.value) {
    window.location.reload();
    return true;
  }

  /** 未知状态，快速检测一次 */
  const updated = await checkUpdate();
  if (updated) {
    window.location.reload();
    return true;
  }

  /** 不是因为更新导致的加载失败，交给上层处理 */
  return false;
}
