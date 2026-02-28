<script setup lang="ts">
/**
 * 基于 reka-ui 的 ContextMenu 组件
 * 提供右键上下文菜单功能
 *
 * @example
 * ```vue
 * <ContextMenu ref="contextMenu" :model="menuItems" />
 * ```
 */
import { ref } from 'vue';
import {
  ContextMenuRoot,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuPortal,
  ContextMenuItem,
} from 'reka-ui';
import type { UiContextMenuInstance, UiContextMenuProps, MenuItem } from './types';

/** 定义 props */
const props = defineProps<UiContextMenuProps>();

/** 内部状态 - 控制菜单显示 */
const openState = ref(false);

/** 菜单位置 */
const position = ref({ x: 0, y: 0 });

/** 定义 emits */
const emit = defineEmits<{}>();

/** 处理打开状态变化 */
const handleUpdateOpen = (value: boolean) => {
  openState.value = value;
};

/** 显示上下文菜单 */
const show = (event: MouseEvent) => {
  position.value = { x: event.clientX, y: event.clientY };
  openState.value = true;
};

/** 隐藏上下文菜单 */
const hide = () => {
  openState.value = false;
};

/** 暴露方法供外部调用 */
defineExpose<UiContextMenuInstance>({ show, hide });

/** 处理菜单项点击 */
const handleItemClick = (item: MenuItem) => {
  if (!item.disabled) {
    item.command?.();
    hide();
  }
};

/** 内容区域样式 */
const contentStyle = {
  zIndex: 10001,
  position: 'fixed',
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
} as const;
</script>

<template>
  <ContextMenuRoot
    :open="openState"
    @update:open="handleUpdateOpen">
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>

    <ContextMenuPortal>
      <ContextMenuContent
        class="bg-white dark:bg-gray-700 rounded-md p-1 shadow-lg min-w-[200px] max-w-[calc(100vw-20px)] z-[10001] animate-in fade-in zoom-in-95 duration-200"
        :style="contentStyle">
        <ContextMenuItem
          v-for="(item, index) in model"
          :key="index"
          :disabled="item.disabled"
          class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="handleItemClick(item)">
          <i v-if="item.icon" :class="item.icon" class="text-base" />
          <span>{{ item.label }}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<style>
/* 不再需要自定义样式，全部使用 Tailwind CSS */
</style>
