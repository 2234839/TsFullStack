<script setup lang="ts">
/**
 * Toast 通知组件
 * 简单的内联通知，替代 PrimeVue Toast
 */
import { computed } from "vue";
import { useToastMessages, useToast } from "@/composables/useToast";

interface ToastAction {
  /** 按钮文案 */
  label: string;
  /** 点击回调 */
  handler: () => void;
}

interface ToastMessage {
  id: number;
  /** Toast 变体：success/error/info/warn/warning/danger */
  variant?: "success" | "error" | "info" | "warn" | "warning" | "danger";
  summary: string;
  detail?: string;
  life?: number;
  /** 可选操作按钮（如"立即刷新"） */
  action?: ToastAction;
}

/** 变体样式映射（静态常量，避免每次渲染重建） */
const VARIANT_CLASSES: Record<NonNullable<ToastMessage["variant"]>, string> = {
  success:
    "bg-success-50 dark:bg-success-900 border-success-200 dark:border-success-700 text-success-800 dark:text-success-100",
  error:
    "bg-danger-50 dark:bg-danger-900 border-danger-200 dark:border-danger-700 text-danger-800 dark:text-danger-100",
  info: "bg-white dark:bg-primary-card border-primary-200 dark:border-primary-700 text-primary-heading dark:text-primary-body",
  warn: "bg-warning-50 dark:bg-warning-900 border-warning-200 dark:border-warning-700 text-warning-800 dark:text-warning-100",
  /** warning 是 warn 的别名 */
  warning:
    "bg-warning-50 dark:bg-warning-900 border-warning-200 dark:border-warning-700 text-warning-800 dark:text-warning-100",
  /** danger 是 error 的别名 */
  danger:
    "bg-danger-50 dark:bg-danger-900 border-danger-200 dark:border-danger-700 text-danger-800 dark:text-danger-100",
};

const MESSAGE_BASE =
  "mb-3 p-4 rounded-lg shadow-lg flex items-start gap-3 animate-in slide-in-from-right transition-all duration-300";

const { messages } = useToastMessages();
const toast = useToast();

/** 消息样式类 */
const messageClasses = computed(
  () => (message: ToastMessage) => `${MESSAGE_BASE} ${VARIANT_CLASSES[message.variant ?? "info"]}`,
);

/** 图标类 */
const iconClasses = {
  success: "pi pi-check-circle text-success-600 dark:text-success-400",
  error: "pi pi-times-circle text-danger-600 dark:text-danger-400",
  info: "pi pi-info-circle text-primary-theme",
  warn: "pi pi-exclamation-triangle text-warning-600 dark:text-warning-400",
  /** warning 是 warn 的别名 */
  warning: "pi pi-exclamation-triangle text-warning-600 dark:text-warning-400",
  /** danger 是 error 的别名 */
  danger: "pi pi-times-circle text-danger-600 dark:text-danger-400",
};
</script>

<template>
  <div class="fixed top-4 right-4 z-9999 w-full max-w-md space-y-2">
    <div v-for="message in messages" :key="message.id" :class="messageClasses(message)">
      <i :class="iconClasses[message.variant ?? 'info']" class="text-xl shrink-0 mt-0.5"></i>
      <div class="flex-1">
        <div class="font-medium">{{ message.summary }}</div>
        <div v-if="message.detail" class="text-sm mt-1 opacity-80">{{ message.detail }}</div>
        <button
          v-if="message.action"
          @click="message.action.handler()"
          class="mt-2 px-3 py-1 text-sm rounded-md bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
        >
          {{ message.action.label }}
        </button>
      </div>
      <button
        @click="toast.remove(message.id)"
        aria-label="Close"
        class="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
      >
        <i class="pi pi-times"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
@keyframes slide-in-from-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-in.slide-in-from-right {
  animation: slide-in-from-right 0.3s ease-out;
}
</style>
