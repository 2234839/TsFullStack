<!--
 * 简单的消息提示组件，替代 PrimeVue Message
-->
<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  variant?: 'success' | 'info' | 'warn' | 'error';
  closable?: boolean;
}

const { variant = 'info', closable = false } = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

const messageClasses = computed(() => {
  const variantClasses = {
    success: 'bg-success-50 border-success-200 text-success-700 dark:bg-success-900/20 dark:border-success-700 dark:text-success-300',
    info: 'bg-info-50 border-info-200 text-info-700 dark:bg-info-900/20 dark:border-info-700 dark:text-info-300',
    warn: 'bg-warning-50 border-warning-200 text-warning-700 dark:bg-warning-900/20 dark:border-warning-700 dark:text-warning-300',
    error: 'bg-danger-50 border-danger-200 text-danger-700 dark:bg-danger-900/20 dark:border-danger-700 dark:text-danger-300',
  };
  return `border rounded-lg p-4 ${variantClasses[variant]}`;
});

const iconClasses = computed(() => {
  const iconMap = {
    success: 'pi pi-check-circle',
    info: 'pi pi-info-circle',
    warn: 'pi pi-exclamation-triangle',
    error: 'pi pi-times-circle',
  };
  return iconMap[variant];
});
</script>

<template>
  <div :class="messageClasses" class="flex items-start gap-3">
    <i :class="iconClasses" class="text-lg mt-0.5 shrink-0"></i>
    <div class="flex-1">
      <slot></slot>
    </div>
    <button
      v-if="closable"
      @click="emit('close')"
      class="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
    >
      <i class="pi pi-times"></i>
    </button>
  </div>
</template>
