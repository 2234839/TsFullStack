<script setup lang="ts">
/**
 * 基于 reka-ui 的 Dialog 组件
 * 提供类型安全的对话框功能
 *
 * @example
 * ```vue
 * <Dialog v-model:open="isOpen" title="对话框标题">
 *   <div>对话框内容</div>
 *   <template #footer>
 *     <div class="flex justify-end gap-2">
 *       <button @click="isOpen = false">取消</button>
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
  DialogClose,
} from 'reka-ui';
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

/** 打开 Dialog */
const open = () => {
  openModel.value = true;
};

/** 关闭 Dialog */
const close = () => {
  openModel.value = false;
};

/** 暴露方法供外部调用 */
defineExpose({
  open,
  close,
});
</script>

<template>
  <DialogRoot v-model:open="openModel">
    <!-- 触发器插槽 -->
    <DialogTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" :open="isOpen" />
    </DialogTrigger>

    <DialogPortal>
      <DialogOverlay class="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogContent
        class="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white dark:bg-gray-800 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg max-h-[85vh]"
      >
        <!-- 关闭按钮 -->
        <DialogClose
          class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-gray-100 data-[state=open]:text-gray-500 dark:ring-offset-gray-950 dark:focus:ring-gray-300 dark:data-[state=open]:bg-gray-800 dark:data-[state=open]:text-gray-400"
        >
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
          <span class="sr-only">关闭</span>
        </DialogClose>

        <!-- 标题 -->
        <DialogTitle v-if="title" class="text-lg font-semibold leading-none tracking-tight text-gray-950 dark:text-gray-50">
          {{ title }}
        </DialogTitle>

        <!-- 描述 -->
        <DialogDescription
          v-if="description"
          class="text-sm text-gray-500 dark:text-gray-400">
          {{ description }}
        </DialogDescription>
        <!-- 当没有描述时，渲染一个隐藏的 DialogDescription 以满足无障碍要求 -->
        <DialogDescription v-else class="sr-only">
          {{ title || '对话框' }}
        </DialogDescription>

        <!-- 主要内容区域 -->
        <div class="overflow-y-auto max-h-[calc(85vh-8rem)]">
          <slot />
        </div>

        <!-- 底部操作区 -->
        <div v-if="$slots.footer" class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <slot name="footer" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
