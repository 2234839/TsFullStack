<script setup lang="ts">
/**
 * 徽章组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Props {
  /** 徽章值 */
  value?: string | number;
  /** 样式变体 */
  variant?: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | string;
}

const { variant = 'secondary' } = defineProps<Props>();

/** 徽章样式类 */
const badgeClasses = computed(() => {
  const base = 'inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full';
  const variantClasses: Record<string, string> = {
    success: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400',
    info: 'bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-400',
    warn: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400',
    danger: 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400',
    secondary: 'bg-secondary-100 text-secondary-800 dark:bg-secondary-700 dark:text-secondary-300',
    contrast: 'bg-primary-800 text-primary-50 dark:bg-primary-50 dark:text-primary-800',
  };
  return `${base} ${variantClasses[variant] || 'bg-secondary-100 text-secondary-800'}`;
});
</script>

<template>
  <span :class="badgeClasses">
    <slot>{{ value }}</slot>
  </span>
</template>
