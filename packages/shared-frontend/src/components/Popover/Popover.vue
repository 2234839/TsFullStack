<script setup lang="ts">
/**
 * 基于 reka-ui 的 Popover 组件
 * 提供类型安全的弹出框功能
 *
 * @example
 * ```vue
 * <Popover v-model:open="isOpen" trigger="click" :show-close-icon="true">
 *   <template #trigger>
 *     <Button>点击打开</Button>
 *   </template>
 *   <div>弹出内容</div>
 * </Popover>
 * ```
 */
import { computed } from 'vue';
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  PopoverPortal,
  PopoverArrow,
} from 'reka-ui';
import type { PopoverRootProps } from 'reka-ui';
import type { UiPopoverEmits, UiPopoverProps } from './types';

/** 定义 props，带有类型默认值 */
const props = withDefaults(defineProps<UiPopoverProps>(), {
  side: () => 'bottom' as const,
  align: () => 'center' as const,
  sideOffset: 8,
  trigger: () => 'click' as const,
  showCloseIcon: false,
  closeOnClickOutside: true,
  defaultOpen: false,
  delayDuration: 200,
});

/** 使用 defineModel 定义双向绑定的 open 状态 */
const openModel = defineModel<boolean>('open', {
  default: false,
});

/** 定义 emits */
const emits = defineEmits<UiPopoverEmits>();

/** 计算当前打开状态 */
const isOpen = computed(() => openModel.value);

/** 计算传递给 PopoverRoot 的 props */
const popoverRootProps = computed<PopoverRootProps>(() => ({
  open: openModel.value,
  defaultOpen: props.defaultOpen,
  disabled: props.disabled,
  delayDuration: props.delayDuration,
}));

/** 计算内容区域的样式 */
const contentStyle = computed(() => ({
  zIndex: 10001,
  '--reka-popover-content-transform-origin': 'var(--reka-popper-transform-origin)',
}));

/** 关闭 Popover */
const close = () => {
  openModel.value = false;
};

/** 打开 Popover */
const open = () => {
  openModel.value = true;
  // 当从关闭变为打开时，触发 open 事件
  if (!isOpen.value) {
    emits('open');
  }
};

/** 切换 Popover 状态 */
const toggle = () => {
  isOpen.value ? close() : open();
};

/** 暴露方法供外部调用 */
defineExpose({
  open,
  close,
  toggle,
});
</script>

<template>
  <PopoverRoot v-bind="popoverRootProps">
    <PopoverTrigger as-child>
      <slot name="trigger" :open="isOpen" :toggle="toggle" />
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        class="ui-popover-content"
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        :style="contentStyle">
        <div
          v-if="showCloseIcon"
          class="ui-popover-close-icon"
          @click="close">
          ×
        </div>
        <slot />
        <PopoverArrow class="ui-popover-arrow" :width="12" :height="6" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style>
/**
 * Popover 内容区域样式
 * 使用深色背景和白色文字
 * 添加平滑的动画效果
 */
.ui-popover-content {
  background-color: rgb(255, 255, 255);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 10px 38px rgba(0, 0, 0, 0.35);
  max-width: calc(100vw - 20px);
  max-height: calc(100vh - 20px);
  overflow: auto;
  animation-duration: 200ms;
  animation-timing-function: ease-out;
  transform-origin: var(--reka-popover-content-transform-origin);
}

/**
 * 根据位置应用不同的动画
 */
.ui-popover-content[data-side='bottom'] {
  animation-name: slideUpAndFade;
}

.ui-popover-content[data-side='top'] {
  animation-name: slideDownAndFade;
}

.ui-popover-content[data-side='left'] {
  animation-name: slideRightAndFade;
}

.ui-popover-content[data-side='right'] {
  animation-name: slideLeftAndFade;
}

/**
 * 关闭图标样式
 */
.ui-popover-close-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  color: rgb(156, 163, 175);
  border-radius: 9999px;
  transition: all 0.2s;
}

.ui-popover-close-icon:hover {
  background-color: rgb(243, 244, 246);
  color: rgb(55, 65, 81);
}

/**
 * Popover 箭头样式
 * 匹配内容区域的背景色
 */
.ui-popover-arrow {
  fill: rgb(255, 255, 255);
}

/**
 * 从上方滑入淡入动画
 */
@keyframes slideUpAndFade {
  from {
    opacity: 0;
    transform: translateY(4px);
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
    transform: translateY(-4px);
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
    transform: translateX(4px);
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
    transform: translateX(-4px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/**
 * 支持深色模式
 */
.dark .ui-popover-content {
  background-color: rgb(31, 41, 55);
}

.dark .ui-popover-arrow {
  fill: rgb(31, 41, 55);
}

.dark .ui-popover-close-icon {
  color: rgb(156, 163, 175);
}

.dark .ui-popover-close-icon:hover {
  background-color: rgb(55, 65, 81);
  color: rgb(229, 231, 235);
}
</style>
