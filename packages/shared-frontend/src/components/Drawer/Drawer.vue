<script setup lang="ts">
/**
 * 基于 reka-ui Drawer primitives 的侧边抽屉组件
 * 支持四侧停靠、swipe 手势关闭、点击遮罩关闭（reka 原生能力）
 *
 * @example
 * ```vue
 * <Drawer v-model:open="visible" side="right">
 *   <div>抽屉内容</div>
 * </Drawer>
 * ```
 */
import { computed } from "vue";
import { DrawerClose, DrawerContent, DrawerOverlay, DrawerPortal, DrawerRoot } from "reka-ui";
import type { UiDrawerProps } from "./types";

/** 组件属性 */
const props = withDefaults(defineProps<UiDrawerProps>(), {
  side: () => "right" as const,
  width: "400px",
  showClose: true,
});

/** v-model:open 双向绑定 */
const openModel = defineModel<boolean>("open", { default: false });

/** swipe 关闭方向：朝停靠侧滑出 */
const swipeDirection = computed(() =>
  props.side === "left"
    ? "left"
    : props.side === "right"
      ? "right"
      : props.side === "top"
        ? "up"
        : "down",
);
</script>

<template>
  <DrawerRoot v-model:open="openModel" :swipe-direction="swipeDirection">
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-[10000] bg-black/50" />
      <DrawerContent
        class="fixed z-[10001] bg-primary-50 shadow-xl outline-none dark:bg-primary-950"
        :class="{
          'left-0 top-0 h-full border-r border-primary-200 dark:border-primary-800':
            side === 'left',
          'right-0 top-0 h-full border-l border-primary-200 dark:border-primary-800':
            side === 'right',
          'top-0 left-0 w-full border-b border-primary-200 dark:border-primary-800': side === 'top',
          'bottom-0 left-0 w-full border-t border-primary-200 dark:border-primary-800':
            side === 'bottom',
        }"
        :style="side === 'left' || side === 'right' ? { width } : undefined"
      >
        <div class="flex h-full flex-col">
          <!-- 头部（header 插槽优先，否则用 title + 关闭按钮） -->
          <div
            v-if="$slots.header || title || showClose"
            class="flex items-center justify-between border-b border-primary-200 p-4 dark:border-primary-800"
          >
            <slot name="header">
              <h3 class="text-primary-900 text-lg font-semibold dark:text-primary-50">
                {{ title }}
              </h3>
            </slot>
            <DrawerClose
              v-if="showClose"
              class="rounded-md p-1 transition-colors hover:bg-primary-100 dark:hover:bg-primary-800"
            >
              <i class="pi pi-times text-primary-700"></i>
            </DrawerClose>
          </div>
          <!-- 内容区域 -->
          <div class="flex-1 overflow-y-auto">
            <slot />
          </div>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
