<template>
  <div ref="rootRef" class="scroll-area-container" :style="containerStyle">
    <ScrollAreaRoot
      :type="type"
      :scroll-hide-delay="scrollHideDelay"
      class="scroll-area-root">
      <ScrollAreaViewport class="scroll-area-viewport">
        <div class="scroll-area-content">
          <slot />
        </div>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar
        v-if="showHorizontalScrollbar()"
        class="scroll-area-scrollbar scroll-area-scrollbar-horizontal"
        orientation="horizontal">
        <ScrollAreaThumb class="scroll-area-thumb" />
      </ScrollAreaScrollbar>
      <ScrollAreaScrollbar
        v-if="showVerticalScrollbar()"
        class="scroll-area-scrollbar scroll-area-scrollbar-vertical"
        orientation="vertical">
        <ScrollAreaThumb class="scroll-area-thumb" />
      </ScrollAreaScrollbar>
      <ScrollAreaCorner
        v-if="showHorizontalScrollbar() && showVerticalScrollbar()"
        class="scroll-area-corner" />
    </ScrollAreaRoot>
  </div>
</template>

<script setup lang="ts">
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
  type ScrollAreaRootProps,
} from 'reka-ui';
import { computed, type HTMLAttributes, type CSSProperties } from 'vue';

/**
 * ScrollArea - 基于 reka-ui 的精致滚动条组件
 *
 * @example
 * ```vue
 * <!-- 固定高度 -->
 * <ScrollArea style="height: 300px;">
 *   <div>很长的内容...</div>
 * </ScrollArea>
 *
 * <!-- 始终显示滚动条 -->
 * <ScrollArea type="always" style="height: 300px;">
 *   <div>内容...</div>
 * </ScrollArea>
 * ```
 */

/** 滚动方向类型 */
type ScrollbarOrientation = 'auto' | 'vertical' | 'horizontal' | 'both';

/** 组件属性扩展 */
interface ScrollAreaProps extends ScrollAreaRootProps {
  /** 额外的 CSS 类名 */
  class?: HTMLAttributes['class'];
  /** 滚动条方向（auto=自动检测, vertical=仅垂直, horizontal=仅水平, both=双向） */
  orientation?: ScrollbarOrientation;
}

/** 组件属性 */
const props = withDefaults(
  defineProps<ScrollAreaProps>(),
  {
    type: 'hover',
    scrollHideDelay: 600,
    orientation: 'auto',
  }
);

/** 计算是否显示水平滚动条 */
const showHorizontalScrollbar = () => {
  return props.orientation === 'auto' ||
         props.orientation === 'horizontal' ||
         props.orientation === 'both';
};

/** 计算是否显示垂直滚动条 */
const showVerticalScrollbar = () => {
  return props.orientation === 'auto' ||
         props.orientation === 'vertical' ||
         props.orientation === 'both';
};

/** 容器样式 - 确保有明确的尺寸 */
const containerStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = {};

  // 设置默认的最小高度
  style.minHeight = '100px';

  return style;
});
</script>

<style scoped>
/** 外层容器 - 提供明确的尺寸约束 */
.scroll-area-container {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
}

/** reka-ui ScrollArea 根容器 */
.scroll-area-root {
  position: relative;
  display: flex;
  flex-direction: row;
  flex: 1;
  overflow: hidden;
  /** 确保根容器至少有视口高度，允许内容撑开 */
  min-height: 0;
}

/** 视口区域 - 实际的滚动区域 */
.scroll-area-viewport {
  flex: 1;
  width: 100%;
  /** 允许内容决定高度，但超出时可以滚动 */
  min-height: 0;
  overflow: hidden;
}

/** 内容包装器 - 确保内容可以撑开并触发滚动 */
.scroll-area-content {
  width: 100%;
  min-width: max-content;
}

/** 滚动条通用样式 */
.scroll-area-scrollbar {
  transition: background-color 150ms ease-out, opacity 150ms ease-out;
  border-radius: 4px;
  z-index: 10;
  flex-shrink: 0;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
}

/** 水平滚动条 */
.scroll-area-scrollbar-horizontal {
  height: 12px;
  width: 100%;
}

/** 垂直滚动条 */
.scroll-area-scrollbar-vertical {
  width: 8px;
  height: 100%;
}

/** 滚动条滑块 - 亮色模式 */
.scroll-area-thumb {
  background-color: rgb(148 163 184 / 0.9);
  border-radius: 4px;
  transition: background-color 150ms ease-out;
}

/** 滚动条滑块悬停 - 亮色模式 */
.scroll-area-thumb:hover {
  background-color: rgb(100 116 139 / 1);
}

/** 滚动条滑块 - 暗色模式 */
@media (prefers-color-scheme: dark) {
  .scroll-area-thumb {
    background-color: rgb(71 85 105 / 0.8);
  }

  .scroll-area-thumb:hover {
    background-color: rgb(100 116 139 / 0.9);
  }
}

/** Tailwind dark mode 支持 */
@layer base {
  .dark .scroll-area-thumb {
    background-color: rgb(71 85 105 / 0.8);
  }

  .dark .scroll-area-thumb:hover {
    background-color: rgb(100 116 139 / 0.9);
  }
}

/** 滚动条角落 */
.scroll-area-corner {
  background-color: transparent;
  flex-shrink: 0;
}

/** 滚动条显示状态 */
.scroll-area-scrollbar[data-state='visible'] {
  opacity: 1;
}

.scroll-area-scrollbar[data-state='hidden'] {
  opacity: 0;
}

/** type="always" 时始终显示滚动条 */
.scroll-area-root[data-type='always'] .scroll-area-scrollbar {
  opacity: 1;
}

/** type="hover" 和 type="scroll" 时的动画 */
.scroll-area-root:not([data-type='always']) .scroll-area-scrollbar {
  animation: fade-in 150ms ease-out;
}

.scroll-area-root:not([data-type='always']) .scroll-area-scrollbar[data-state='hidden'] {
  animation: fade-out 150ms ease-out;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
</style>
