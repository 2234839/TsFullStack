<template>
  <div aria-hidden="true" class="route-progress" :class="{ 'route-progress--active': visible }">
    <div
      class="route-progress__bar bg-linear-to-r from-info-400 to-info-600"
      :style="{ transform: `scaleX(${progress / 100})` }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { router } from "@/router";

/**
 * 路由导航进度条：解决「URL 已变化但页面还在加载懒加载 chunk」期间无任何反馈的问题。
 * - 导航开始（beforeEach）：延迟一小段时间后显示，快速导航（缓存页/同步组件）不会闪条
 * - 显示后匀速爬升模拟进度，导航确认（afterEach）时冲到 100% 并淡出
 * - 取消/重定向的导航不回调 afterEach：由最终完成的导航负责收尾（flag 制）
 * - 兜底超时：任何异常情况下进度条都不会永久卡住
 *
 * 注意：页面处于后台 tab 时浏览器会把 setTimeout 节流到 ≥1s，此时进度条可能不显示——
 * 这是可接受的（用户看不见后台导航），finish() 的收尾逻辑不依赖显示状态。
 */

/** 是否显示（透明度过渡由 CSS 完成） */
const visible = ref(false);
/** 进度 0-100，通过 scaleX 渲染（GPU 合成，比改 width 更流畅） */
const progress = ref(0);

/** 是否有导航进行中。连点菜单/导航被取消时，只有第一个导航 start、最后完成的导航 finish */
let pending = false;

/** 显示延迟帧计数（rAF 驱动：前台才计数，后台 tab 自动暂停——正好符合"看不见就不显示"） */
let showFrames = 0;

/** 显示延迟阈值（帧）。60fps 下约 200ms；页面卡顿时自动放慢，避免闪烁 */
const SHOW_DELAY_FRAMES = 12;
/** 兜底：导航超过此时长强制收尾，保证异常场景下进度条不会卡死 */
const FORCE_FINISH_MS = 10_000;

/** 爬升定时器 */
let trickleTimer: ReturnType<typeof setInterval> | undefined;
/** 收尾复位定时器 */
let resetTimer: ReturnType<typeof setTimeout> | undefined;
/** 兜底超时定时器 */
let forceTimer: ReturnType<typeof setTimeout> | undefined;
/** 显示延迟 rAF 句柄（0 是合法 id，用 -1 表示未调度） */
let rafId = -1;

function clearTimers() {
  if (rafId !== -1) cancelAnimationFrame(rafId);
  rafId = -1;
  if (trickleTimer !== undefined) clearInterval(trickleTimer);
  trickleTimer = undefined;
  if (resetTimer !== undefined) clearTimeout(resetTimer);
  resetTimer = undefined;
  if (forceTimer !== undefined) clearTimeout(forceTimer);
  forceTimer = undefined;
}

/** 帧计数到达阈值后真正显示 */
function show() {
  visible.value = true;
  progress.value = 15;
  trickleTimer = setInterval(() => {
    progress.value = Math.min(progress.value + Math.random() * 3 + 1, 88);
  }, 240);
}

/** 导航开始：重置状态，帧计数延迟显示 */
function start() {
  pending = true;
  clearTimers();
  progress.value = 0;
  showFrames = 0;
  const countFrame = () => {
    if (!pending) return;
    showFrames++;
    if (showFrames >= SHOW_DELAY_FRAMES) {
      show();
    } else {
      rafId = requestAnimationFrame(countFrame);
    }
  };
  rafId = requestAnimationFrame(countFrame);
  forceTimer = setTimeout(() => {
    if (pending) finish();
  }, FORCE_FINISH_MS);
}

/** 导航结束：冲到 100%、淡出并静默归零 */
function finish() {
  pending = false;
  clearTimers();
  if (!visible.value) return;
  progress.value = 100;
  resetTimer = setTimeout(() => {
    visible.value = false;
    /** 淡出完成后再归零，避免下次显示时从 100 跳变 */
    setTimeout(() => {
      progress.value = 0;
    }, 300);
  }, 200);
}

router.beforeEach(() => {
  if (!pending) start();
});
router.afterEach(() => finish());
router.onError(() => finish());
</script>

<style scoped>
.route-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 9999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.25s ease;
}
.route-progress--active {
  opacity: 1;
}
.route-progress__bar {
  height: 100%;
  transform-origin: 0 50%;
  transition: transform 0.24s ease-out;
  will-change: transform;
}
</style>
