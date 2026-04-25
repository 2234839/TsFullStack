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
  /** 图标类名 */
  icon?: string;
}

defineSlots<{
  /** 默认内容插槽 */
  default?: (props: {}) => any;
  /** 图标插槽 */
  icon?: (props: {}) => any;
}>();

const { variant = 'secondary', rounded = false } = defineProps<Props>();

/** 变体样式映射（静态常量） */
const TAG_VARIANT_CLASSES: Record<string, string> = {
  success: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400',
  info: 'bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-400',
  warn: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400',
  danger: 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400',
  secondary: 'bg-secondary-100 text-secondary-800 dark:bg-secondary-700 dark:text-secondary-300',
  contrast: 'bg-primary-800 text-primary-50 dark:bg-primary-50 dark:text-primary-800',
};

/** 标签样式类 */
const tagClasses = computed(() => {
  const base = 'inline-flex items-center gap-1 px-2.5 py-0.5 text-sm font-medium';
  const roundedClass = rounded ? 'rounded-full' : 'rounded';
  return `${base} ${roundedClass} ${TAG_VARIANT_CLASSES[variant]}`;
});
</script>

<template>
  <span :class="tagClasses">
    <slot name="icon">
      <i v-if="icon" :class="icon" class="text-xs"></i>
    </slot>
    <slot>{{ value }}</slot>
  </span>
</template>
