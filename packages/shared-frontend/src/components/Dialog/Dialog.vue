<script setup lang="ts">
/**
 * 基于 reka-ui 的 Dialog 组件
 * 提供类型安全的对话框功能
 *
 * @example
 * ```vue
 * <Dialog v-model:open="isOpen" title="对话框标题" :modal="true">
 *   <div>对话框内容</div>
 *   <template #footer>
 *     <div class="flex justify-end gap-2">
 *       <button @click="close">取消</button>
 *       <button @click="confirm">确定</button>
 *     </div>
 *   </template>
 * </Dialog>
 * ```
 */
import { computed } from 'vue';
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  useForwardPropsEmits,
} from 'reka-ui';
import type { DialogContentProps, DialogContentEmits, DialogRootProps } from 'reka-ui';
import type { UiDialogEmits, UiDialogProps } from './types';

/** 定义 props */
const props = withDefaults(defineProps<UiDialogProps>(), {
  modal: true,
  defaultOpen: false,
});

/** 使用 defineModel 定义双向绑定的 open 状态 */
const openModel = defineModel<boolean>('open', {
  default: false,
});

/** 定义 emits */
const emits = defineEmits<UiDialogEmits>();

/** 处理 ESC 键按下事件 */
const handleEscapeKeyDown = (event: KeyboardEvent) => {
  // 触发外部的事件监听器
  emits('escapeKeyDown', event);

  // 如果事件没有被阻止，则关闭对话框
  if (!event.defaultPrevented) {
    close();
  }
};

/** 处理点击外部事件 */
const handleInteractOutside = (event: CustomEvent) => {
  emits('interactOutside', event);

  if (!event.defaultPrevented) {
    close();
  }
};

/** 处理点击外部事件 */
const handlePointerDownOutside = (event: CustomEvent) => {
  emits('pointerDownOutside', event);
};

/** 插槽类型定义 */
defineSlots<{
  /** 触发按钮内容 */
  trigger?: (props: { open: boolean }) => void;
  /** 默认内容 */
  default: () => void;
  /** 底部操作区 */
  footer?: () => void;
}>();

/** 计算当前打开状态 */
const isOpen = computed(() => openModel.value);

/** 计算传递给 DialogRoot 的 props */
const dialogRootProps = computed<DialogRootProps>(() => ({
  open: openModel.value,
  defaultOpen: props.defaultOpen,
  modal: props.modal,
}));

/** 计算传递给 DialogContent 的 props */
const dialogContentProps = computed(() => {
  const {
    title,
    description,
    defaultOpen,
    modal,
    ...contentProps
  } = props;

  return contentProps;
});

/** 关闭 Dialog */
const close = () => {
  openModel.value = false;
};

/** 打开 Dialog */
const open = () => {
  openModel.value = true;
};

/** 暴露方法供外部调用 */
defineExpose({
  open,
  close,
});
</script>

<template>
  <DialogRoot v-bind="dialogRootProps">
    <!-- 触发器插槽 -->
    <DialogTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" :open="isOpen" />
    </DialogTrigger>

    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 bg-black/50 z-[50] transition-opacity duration-200"
        :class="{ 'opacity-0': !isOpen, 'opacity-100': isOpen }" />
      <DialogContent
        v-bind="dialogContentProps"
        @escape-key-down="handleEscapeKeyDown"
        @interact-outside="handleInteractOutside"
        @pointer-down-outside="handlePointerDownOutside"
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-[min(90vw,600px)] max-h-[min(85vh,600px)] w-full p-6 z-[51] overflow-auto transition-all duration-200"
        :class="{ 'opacity-0 scale-95': !isOpen, 'opacity-100 scale-100': isOpen }">
        <!-- 关闭按钮 -->
        <button
          type="button"
          @click="close"
          class="absolute top-4 right-4 inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="关闭对话框">
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <path
              d="M11.7816 4.03147C11.8868 3.92624 11.8868 3.75418 11.7816 3.64895L11.1333 3.00065C11.0281 2.89542 10.8561 2.89542 10.7508 3.00065L7.49999 6.25151L4.24918 3.00065C4.14395 2.89542 3.97189 2.89542 3.86666 3.00065L3.21836 3.64895C3.11313 3.75418 3.11313 3.92624 3.21836 4.03147L6.46922 7.28232L3.21836 10.5332C3.11313 10.6384 3.11313 10.8105 3.21836 10.9157L3.86666 11.564C3.97189 11.6692 4.14395 11.6692 4.24918 11.564L7.49999 8.31313L10.7508 11.564C10.8561 11.6692 11.0281 11.6692 11.1333 11.564L11.7816 10.9157C11.8868 10.8105 11.8868 10.6384 11.7816 10.5332L8.53077 7.28232L11.7816 4.03147Z"
              fill="currentColor"
              fill-rule="evenodd"
              clip-rule="evenodd" />
          </svg>
        </button>

        <!-- 标题 -->
        <DialogTitle v-if="title" class="text-lg font-semibold text-gray-900 dark:text-gray-100 pr-8 mb-2">
          {{ title }}
        </DialogTitle>

        <!-- 描述 -->
        <DialogDescription
          v-if="description"
          class="text-sm text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
          {{ description }}
        </DialogDescription>
        <!-- 当没有描述时，渲染一个隐藏的 DialogDescription 以满足无障碍要求 -->
        <DialogDescription v-else class="sr-only">
          {{ title || '对话框' }}
        </DialogDescription>

        <!-- 主要内容 -->
        <div class="mb-4">
          <slot />
        </div>

        <!-- 底部操作区 -->
        <div v-if="$slots.footer" class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <slot name="footer" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
/* 不再需要自定义样式，全部使用 Tailwind CSS */
</style>
