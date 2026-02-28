<!--
 * 简单的消息提示组件，替代 PrimeVue Message
-->
<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  severity?: 'success' | 'info' | 'warn' | 'error';
  closable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  severity: 'info',
  closable: false,
});

const emit = defineEmits<{
  close: [];
}>();

const messageClasses = computed(() => {
  const severityClasses = {
    success: 'bg-success-50 border-success-200 text-success-800 dark:bg-success-900/20 dark:border-success-800 dark:text-success-200',
    info: 'bg-info-50 border-info-200 text-info-800 dark:bg-info-900/20 dark:border-info-800 dark:text-info-200',
    warn: 'bg-warning-50 border-warning-200 text-warning-800 dark:bg-warning-900/20 dark:border-warning-800 dark:text-warning-200',
    error: 'bg-danger-50 border-danger-200 text-danger-800 dark:bg-danger-900/20 dark:border-danger-800 dark:text-danger-200',
  };
  return `border rounded-lg p-4 ${severityClasses[props.severity]}`;
});

const iconClasses = computed(() => {
  const iconMap = {
    success: 'pi pi-check-circle',
    info: 'pi pi-info-circle',
    warn: 'pi pi-exclamation-triangle',
    error: 'pi pi-times-circle',
  };
  return iconMap[props.severity];
});
</script>

<template>
  <div :class="messageClasses" class="flex items-start gap-3">
    <i :class="iconClasses" class="text-lg mt-0.5 flex-shrink-0"></i>
    <div class="flex-1">
      <slot></slot>
    </div>
    <button
      v-if="closable"
      @click="emit('close')"
      class="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
    >
      <i class="pi pi-times"></i>
    </button>
  </div>
</template>
