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
import { ref, watch } from 'vue';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuPortal,
} from 'reka-ui';
import type { UiDropdownEmits, UiDropdownProps } from './types';

/** 定义 props */
const props = withDefaults(defineProps<UiDropdownProps>(), {
  side: () => 'bottom' as const,
  align: () => 'center' as const,
  sideOffset: 8,
  showCloseIcon: false,
  closeOnClickOutside: true,
  defaultOpen: false,
});

/** 定义 model - 用于 v-model 双向绑定 */
const modelValue = defineModel<boolean>({ default: false });

/** 内部状态 - 用于 DropdownMenuRoot */
const openState = ref(props.defaultOpen);

/** 同步外部 modelValue 到内部状态 */
watch(modelValue, (value) => {
  openState.value = value;
});

/** 定义 emits */
const emit = defineEmits<UiDropdownEmits>();

/** 处理打开状态变化 */
const handleUpdateOpen = (value: boolean) => {
  openState.value = value;
  modelValue.value = value;
  emit('update:open', value);
  if (value) {
    emit('open');
  }
};

/** 关闭 Dropdown */
const close = () => handleUpdateOpen(false);

/** 打开 Dropdown */
const open = () => handleUpdateOpen(true);

/** 切换 Dropdown 状态 */
const toggle = () => (openState.value ? close() : open());

/** 暴露方法供外部调用 */
defineExpose({ open, close, toggle });

/** 内容区域样式 */
const contentStyle = {
  zIndex: 10001,
  '--reka-dropdown-menu-content-transform-origin': 'var(--reka-popper-transform-origin)',
};
</script>

<template>
  <DropdownMenuRoot
    :open="openState"
    :dir="props.dir"
    @update:open="handleUpdateOpen">
    <DropdownMenuTrigger as-child>
      <slot name="trigger" :open="openState" :toggle="toggle" />
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
