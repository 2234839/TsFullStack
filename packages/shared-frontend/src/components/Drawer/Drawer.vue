<script setup lang="ts">
/**
 * 基于 reka-ui Dialog 的 Drawer 组件
 * 提供侧边抽屉功能
 *
 * @example
 * ```vue
 * <Drawer v-model:open="visible" side="right">
 *   <div>抽屉内容</div>
 * </Drawer>
 * ```
 */
import { computed, ref, watch } from 'vue';
import { DialogRoot, DialogPortal } from 'reka-ui';
import type { UiDrawerEmits, UiDrawerProps } from './types';

/** 定义 props */
const props = withDefaults(defineProps<UiDrawerProps>(), {
  side: () => 'right' as const,
  width: '400px',
  height: '300px',
  showClose: false,
  closeOnClickOutside: true,
});

/** 定义 model - 用于 v-model 双向绑定 */
const modelValue = defineModel<boolean>({ default: false });

/** 定义 emits */
const emit = defineEmits<UiDrawerEmits>();

/** 内部状态 */
const openState = ref(modelValue.value || false);

/** 同步外部 modelValue 到内部状态 */
watch(modelValue, (value) => {
  openState.value = value;
});

/** 处理打开状态变化 */
const handleUpdateOpen = (value: boolean) => {
  openState.value = value;
  modelValue.value = value;
  if (!value) {
    emit('close');
  }
};

/** 关闭 Drawer */
const close = () => handleUpdateOpen(false);

/** 打开 Drawer */
const open = () => handleUpdateOpen(true);

/** 暴露方法供外部调用 */
defineExpose({ open, close });

/** 抽屉样式 */
const drawerStyle = computed(() => {
  const base: Record<string, string> = {
    zIndex: '10001',
  };

  if (props.side === 'left' || props.side === 'right') {
    base.width = props.width;
    base.height = '100vh';
  } else {
    base.width = '100vw';
    base.height = props.height;
  }

  return base;
});

/** 抽屉容器样式类 */
const drawerClasses = computed(() => {
  const base = 'fixed bg-white dark:bg-gray-800 shadow-xl';

  const sideClasses = {
    left: 'left-0 top-0 h-full border-r border-gray-200 dark:border-gray-700',
    right: 'right-0 top-0 h-full border-l border-gray-200 dark:border-gray-700',
    top: 'top-0 left-0 w-full border-b border-gray-200 dark:border-gray-700',
    bottom: 'bottom-0 left-0 w-full border-t border-gray-200 dark:border-gray-700',
  };

  return `${base} ${sideClasses[props.side]}`;
});
</script>

<template>
  <DialogRoot
    :open="openState"
    @update:open="handleUpdateOpen">
    <DialogPortal>
      <!-- 遮罩层 -->
      <Transition
        enter-active-class="transition-opacity ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0">
        <div
          v-if="openState"
          class="fixed inset-0 bg-black/50 z-[10000]"
          @click="closeOnClickOutside ? close() : null">
        </div>
      </Transition>

      <!-- 抽屉内容 -->
      <Transition
        enter-active-class="transition-transform ease-out duration-300"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform ease-in duration-200"
        leave-from-class="translate-x-0"
        leave-to-class="translate-x-full">
        <div
          v-if="openState"
          :class="drawerClasses"
          :style="drawerStyle">
          <!-- 头部 -->
          <div
            v-if="title || showClose"
            class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 v-if="title" class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ title }}
            </h3>
            <button
              v-if="showClose"
              @click="close"
              class="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <i class="pi pi-times text-gray-500"></i>
            </button>
          </div>

          <!-- 内容区域 -->
          <div class="flex-1 overflow-y-auto">
            <slot />
          </div>
        </div>
      </Transition>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
/* 不再需要自定义样式，全部使用 Tailwind CSS */
</style>
