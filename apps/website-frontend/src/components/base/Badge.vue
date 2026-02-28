<script setup lang="ts">
/**
 * 徽章组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Props {
  /** 徽章值 */
  value?: string | number;
  /** 严重程度 */
  severity?: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | string;
}

const props = withDefaults(defineProps<Props>(), {
  severity: 'secondary',
});

/** 徽章样式类 */
const badgeClasses = computed(() => {
  const base = 'inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full';
  const severityClasses: Record<string, string> = {
    success: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400',
    info: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400',
    warn: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    danger: 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400',
    secondary: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    contrast: 'bg-gray-800 text-white dark:bg-white dark:text-gray-800',
  };
  return `${base} ${severityClasses[props.severity] || 'bg-gray-100 text-gray-800'}`;
});
</script>

<template>
  <span :class="badgeClasses">
    <slot>{{ value }}</slot>
  </span>
</template>
