<!-- ABOUTME: 沙箱嵌入组件 — 沙箱 iframe + 页面内展开/收缩 + 浏览器全屏（两级放大），树洞 HTML 演示等场景复用 -->
<template>
  <div class="mb-4">
    <!-- 工具条：标签 + 调用方扩展按钮 + 展开/全屏切换 -->
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs text-primary-subtle flex items-center gap-1">
        <i class="pi pi-shield"></i>
        {{ t('沙箱隔离的 HTML 演示') }}
      </span>
      <div class="flex items-center gap-1">
        <slot name="toolbar" />
        <Button
          :label="isFullscreen ? t('收缩窗口') : t('窗口全屏')"
          :icon="isFullscreen ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
          variant="text"
          size="small"
          @click="toggle()"
        />
        <Button
          :label="isExpanded ? t('收缩') : t('放大')"
          :icon="isExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
          variant="text"
          size="small"
          @click="isExpanded = !isExpanded"
        />
      </div>
    </div>

    <!-- iframe：普通 h-96 / 页面内放大时占满视口高度 -->
    <iframe
      ref="frameRef"
      :src="src"
      sandbox="allow-scripts"
      allowfullscreen
      loading="lazy"
      referrerpolicy="no-referrer"
      class="w-full rounded-lg border border-primary-200 dark:border-primary-700 bg-white transition-[height] duration-200"
      :class="isExpanded ? 'h-[80vh]' : 'h-96'"
      :title="title"
    />
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/components/base';
import { useI18n } from '@/composables/useI18n';
import { useFullscreen } from '@vueuse/core';
import { ref } from 'vue';

/** 沙箱内容地址（必须是 /embed/:id 这类已做 CSP sandbox 的输出） */
defineProps<{
  src: string;
  /** iframe 标题（无障碍） */
  title: string;
}>();

const { t } = useI18n();
const frameRef = ref<HTMLIFrameElement | null>(null);
/** 浏览器窗口级全屏（Esc 退出自动同步） */
const { isFullscreen, toggle } = useFullscreen(frameRef);
/** 页面内放大（高度 96 → 80vh，不离开文档流） */
const isExpanded = ref(false);
</script>
