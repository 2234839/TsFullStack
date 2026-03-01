<script setup lang="ts">
/**
 * Toast 通知组件
 * 简单的内联通知，替代 PrimeVue Toast
 */
import { computed } from 'vue';
import { useToastMessages, useToast } from '@/composables/useToast';

interface ToastMessage {
  id: number;
  /** Toast 变体：success/error/info/warn/warning/danger */
  variant?: 'success' | 'error' | 'info' | 'warn' | 'warning' | 'danger';
  summary: string;
  detail?: string;
  life?: number;
}

const { messages } = useToastMessages();
const toast = useToast();

/** 消息样式类 */
const messageClasses = computed(() => (message: ToastMessage) => {
  const base = 'mb-3 p-4 rounded-lg shadow-lg flex items-start gap-3 animate-in slide-in-from-right transition-all duration-300';

  const variantClasses = {
    success: 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800 text-success-800 dark:text-success-200',
    error: 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800 text-danger-800 dark:text-danger-200',
    info: 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-800 dark:text-primary-200',
    warn: 'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800 text-warning-800 dark:text-warning-200',
    /** warning 是 warn 的别名 */
    warning: 'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800 text-warning-800 dark:text-warning-200',
    /** danger 是 error 的别名 */
    danger: 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800 text-danger-800 dark:text-danger-200',
  };

  return `${base} ${variantClasses[message.variant || 'info']}`;
});

/** 图标类 */
const iconClasses = {
  success: 'pi pi-check-circle text-success-600 dark:text-success-400',
  error: 'pi pi-times-circle text-danger-600 dark:text-danger-400',
  info: 'pi pi-info-circle text-primary-600 dark:text-primary-400',
  warn: 'pi pi-exclamation-triangle text-warning-600 dark:text-warning-400',
  /** warning 是 warn 的别名 */
  warning: 'pi pi-exclamation-triangle text-warning-600 dark:text-warning-400',
  /** danger 是 error 的别名 */
  danger: 'pi pi-times-circle text-danger-600 dark:text-danger-400',
};
</script>

<template>
  <div class="fixed top-4 right-4 z-50 w-full max-w-md space-y-2">
    <div
      v-for="message in messages"
      :key="message.id"
      :class="messageClasses(message)">
      <i :class="iconClasses[message.variant || 'info']" class="text-xl shrink-0 mt-0.5"></i>
      <div class="flex-1">
        <div class="font-medium">{{ message.summary }}</div>
        <div v-if="message.detail" class="text-sm mt-1 opacity-80">{{ message.detail }}</div>
      </div>
      <button
        @click="toast.remove(message.id)"
        class="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
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
