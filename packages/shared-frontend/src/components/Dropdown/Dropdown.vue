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
import { computed } from 'vue';
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

/** 内部状态 - 用于 DropdownMenuRoot，直接使用 modelValue */
const openState = modelValue;

/** 定义 emits */
const emit = defineEmits<UiDropdownEmits>();

/** 处理打开状态变化 */
const handleUpdateOpen = (value: boolean) => {
  modelValue.value = value;
  emit('update:modelValue', value);
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
        class="bg-white dark:bg-gray-700 rounded-md p-1.5 shadow-lg min-w-[200px] max-w-[calc(100vw-20px)] max-h-[calc(100vh-20px)] overflow-auto z-[10001] animate-in fade-in zoom-in-95 duration-200"
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        :style="contentStyle">
        <div
          v-if="showCloseIcon"
          class="absolute top-2 right-2 w-5 h-5 flex items-center justify-center cursor-pointer text-base text-gray-400 dark:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200 transition-all z-10"
          @click="close">
          ×
        </div>
        <slot />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style>
/* 不再需要自定义样式，全部使用 Tailwind CSS */
</style>
