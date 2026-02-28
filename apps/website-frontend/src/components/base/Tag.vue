<script setup lang="ts">
/**
 * 标签组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Props {
  /** 标签值 */
  value?: string | number;
  /** 样式变体 */
  variant?: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';
  /** 是否圆角 */
  rounded?: boolean;
  /** 图标 */
  icon?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  rounded: false,
});

/** 标签样式类 */
const tagClasses = computed(() => {
  const base = 'inline-flex items-center gap-1 px-2.5 py-0.5 text-sm font-medium';
  const roundedClass = props.rounded ? 'rounded-full' : 'rounded';

  const variantClasses = {
    success: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400',
    info: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400',
    warn: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    danger: 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400',
    secondary: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    contrast: 'bg-gray-800 text-white dark:bg-white dark:text-gray-800',
  };

  return `${base} ${roundedClass} ${variantClasses[props.variant]}`;
});
</script>

<template>
  <span :class="tagClasses">
    <i v-if="icon" :class="icon" class="text-xs"></i>
    <slot>{{ value }}</slot>
  </span>
</template>
