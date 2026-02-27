<script setup lang="ts">
/**
 * 基于 reka-ui 的 Tooltip 组件
 * 提供类型安全的提示框功能
 *
 * @example
 * ```vue
 * <Tooltip content="提示内容" side="top">
 *   <Button>悬停显示提示</Button>
 * </Tooltip>
 * ```
 */
import { type CSSProperties, computed } from 'vue';
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
  TooltipPortal,
  TooltipArrow,
  useForwardPropsEmits,
} from 'reka-ui';
import type { TooltipRootProps } from 'reka-ui';
import type { UiTooltipEmits, UiTooltipProps } from './types';

/** 定义 props，带有类型默认值 */
const props = withDefaults(defineProps<UiTooltipProps>(), {
  side: () => 'top' as const,
  align: () => 'center' as const,
  sideOffset: 5,
  delayDuration: 200,
  skipDelayDuration: 300,
});

/** 定义 emits */
const emits = defineEmits<UiTooltipEmits>();

/**
 * 转发 props 和 emits 到 reka-ui 的 TooltipRoot
 * 确保 props 变化时能够正确传递
 */
const forwarded = useForwardPropsEmits(
  computed<TooltipRootProps>(() => ({
    delayDuration: props.delayDuration,
    skipDelayDuration: props.skipDelayDuration,
    disableHoverableContent: props.disableHoverableContent,
    disabled: props.disabled,
    open: props.open,
    defaultOpen: props.defaultOpen,
  })),
  emits,
);

/** 计算内容区域的样式 */
const contentStyle = computed<CSSProperties>(() => ({
  '--reka-tooltip-content-transform-origin': 'var(--reka-popper-transform-origin)',
  zIndex: 9999,
}));
</script>

<template>
  <TooltipProvider
    :delay-duration="delayDuration"
    :skip-delay-duration="skipDelayDuration">
    <TooltipRoot v-bind="forwarded">
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>

      <TooltipPortal>
        <TooltipContent
          class="ui-tooltip-content"
          :side="side"
          :align="align"
          :side-offset="sideOffset"
          :style="contentStyle">
          <slot name="content">
            {{ content }}
          </slot>
          <TooltipArrow class="ui-tooltip-arrow" :width="11" :height="5" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<style>
/**
 * Tooltip 内容区域样式
 * 使用深色背景和白色文字
 * 添加平滑的动画效果
 */
.ui-tooltip-content {
  background-color: rgb(31, 41, 55);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1;
  user-select: none;
  white-space: nowrap;
  animation-duration: 200ms;
  animation-timing-function: ease-out;
  transform-origin: var(--reka-tooltip-content-transform-origin);
}

/**
 * 根据位置应用不同的动画
 */
.ui-tooltip-content[data-side='bottom'] {
  animation-name: slideDownAndFade;
}

.ui-tooltip-content[data-side='left'] {
  animation-name: slideLeftAndFade;
}

.ui-tooltip-content[data-side='right'] {
  animation-name: slideRightAndFade;
}

.ui-tooltip-content[data-side='top'] {
  animation-name: slideUpAndFade;
}

/**
 * Tooltip 箭头样式
 * 匹配内容区域的背景色
 */
.ui-tooltip-arrow {
  fill: rgb(31, 41, 55);
}

/**
 * 从上方滑入淡入动画
 */
@keyframes slideUpAndFade {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/**
 * 从下方滑入淡入动画
 */
@keyframes slideDownAndFade {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/**
 * 从左侧滑入淡入动画
 */
@keyframes slideLeftAndFade {
  from {
    opacity: 0;
    transform: translateX(2px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/**
 * 从右侧滑入淡入动画
 */
@keyframes slideRightAndFade {
  from {
    opacity: 0;
    transform: translateX(-2px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
