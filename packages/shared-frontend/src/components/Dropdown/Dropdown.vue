<script setup lang="ts">
/**
 * 基于 reka-ui 的 Dropdown 组件
 * 提供类型安全的下拉菜单功能
 *
 * @example
 * ```vue
 * <Dropdown v-model="open">
 *   <template #trigger>
 *     <Button>点击打开</Button>
 *   </template>
 *   <div>下拉内容</div>
 * </Dropdown>
 * ```
 */
import { computed, ref } from 'vue';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuPortal,
  useForwardPropsEmits,
} from 'reka-ui';
import type { DropdownMenuRootProps } from 'reka-ui';
import type { UiDropdownEmits, UiDropdownProps } from './types';

/** 定义 props，带有类型默认值 */
const props = withDefaults(defineProps<UiDropdownProps>(), {
  side: () => 'bottom' as const,
  align: () => 'center' as const,
  sideOffset: 8,
  showCloseIcon: false,
  closeOnClickOutside: true,
  defaultOpen: false,
});

/** 定义 model */
const modelValue = defineModel<boolean>({ default: false });

/** 定义 emits */
const emits = defineEmits<UiDropdownEmits>();

/** 内部状态管理 */
const internalOpen = ref(props.defaultOpen);

/** 计算当前打开状态 */
const isOpen = computed(() => props.open ?? modelValue.value ?? internalOpen.value);

/** 更新打开状态 */
const updateIsOpen = (value: boolean) => {
  const wasClosed = !isOpen.value;
  internalOpen.value = value;
  modelValue.value = value;
  emits('update:open', value);
  // 当从关闭变为打开时，触发 open 事件
  if (wasClosed && value) {
    emits('open');
  }
};

/**
 * 转发 props 到 reka-ui 的 DropdownMenuRoot
 */
const forwarded = useForwardPropsEmits(
  computed<DropdownMenuRootProps>(() => ({
    open: isOpen,
    defaultOpen: props.defaultOpen,
    dir: props.dir,
  })),
  emits,
);

/** 计算内容区域的样式 */
const contentStyle = computed(() => ({
  zIndex: 10001,
  '--reka-dropdown-menu-content-transform-origin': 'var(--reka-popper-transform-origin)',
}));

/** 关闭 Dropdown */
const close = () => {
  updateIsOpen(false);
};

/** 打开 Dropdown */
const open = () => {
  updateIsOpen(true);
};

/** 切换 Dropdown 状态 */
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
  <DropdownMenuRoot v-bind="forwarded">
    <DropdownMenuTrigger as-child>
      <slot name="trigger" :open="isOpen" :toggle="toggle" />
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        class="ui-dropdown-content"
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        :style="contentStyle">
        <div
          v-if="showCloseIcon"
          class="ui-dropdown-close-icon"
          @click="close">
          ×
        </div>
        <slot />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style>
/**
 * Dropdown 内容区域样式
 * 使用白色背景
 * 添加平滑的动画效果
 */
.ui-dropdown-content {
  background-color: rgb(255, 255, 255);
  border-radius: 6px;
  padding: 5px;
  box-shadow: 0 10px 38px rgba(0, 0, 0, 0.35);
  min-width: 200px;
  max-width: calc(100vw - 20px);
  max-height: calc(100vh - 20px);
  overflow: auto;
  animation-duration: 200ms;
  animation-timing-function: ease-out;
  transform-origin: var(--reka-dropdown-menu-content-transform-origin);
}

/**
 * 根据位置应用不同的动画
 */
.ui-dropdown-content[data-side='bottom'] {
  animation-name: slideUpAndFade;
}

.ui-dropdown-content[data-side='top'] {
  animation-name: slideDownAndFade;
}

.ui-dropdown-content[data-side='left'] {
  animation-name: slideRightAndFade;
}

.ui-dropdown-content[data-side='right'] {
  animation-name: slideLeftAndFade;
}

/**
 * 关闭图标样式
 */
.ui-dropdown-close-icon {
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
  z-index: 1;
}

.ui-dropdown-close-icon:hover {
  background-color: rgb(243, 244, 246);
  color: rgb(55, 65, 81);
}

/**
 * Dropdown 箭头样式
 * 匹配内容区域的背景色
 */
.ui-dropdown-arrow {
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
@media (prefers-color-scheme: dark) {
  .ui-dropdown-content {
    background-color: rgb(31, 41, 55);
  }

  .ui-dropdown-arrow {
    fill: rgb(31, 41, 55);
  }

  .ui-dropdown-close-icon {
    color: rgb(156, 163, 175);
  }

  .ui-dropdown-close-icon:hover {
    background-color: rgb(55, 65, 81);
    color: rgb(229, 231, 235);
  }
}
</style>
