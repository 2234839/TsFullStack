<script setup lang="ts">
/**
 * 基础按钮组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Props {
  /** 按钮类型 */
  variant?: 'primary' | 'secondary' | 'text' | 'danger' | 'ghost' | 'icon';
  /** 按钮尺寸 */
  size?: 'sm' | 'md' | 'lg' | 'small';
  /** 是否禁用 */
  disabled?: boolean;
  /** 按钮类型属性 */
  type?: 'button' | 'submit' | 'reset';
  /** 按钮文本 */
  label?: string;
  /** 图标类名 */
  icon?: string;
  /** 是否加载中 */
  loading?: boolean;
  /** 是否圆角 */
  rounded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  type: 'button',
  loading: false,
  rounded: false,
});

/** 按钮样式类 */
const buttonClasses = computed(() => {
  const base = props.rounded
    ? 'inline-flex items-center justify-center rounded-full font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
    : 'inline-flex items-center justify-center rounded-md font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeClasses: Record<string, string> = {
    sm: props.variant === 'ghost' ? 'text-sm' : props.variant === 'icon' ? 'p-1.5 text-sm' : 'px-3 py-1.5 text-sm',
    small: props.variant === 'ghost' ? 'text-sm' : props.variant === 'icon' ? 'p-1.5 text-sm' : 'px-3 py-1.5 text-sm',
    md: props.variant === 'ghost' ? 'text-base' : props.variant === 'icon' ? 'p-2 text-base' : 'px-4 py-2 text-base',
    lg: props.variant === 'ghost' ? 'text-lg' : props.variant === 'icon' ? 'p-3 text-lg' : 'px-6 py-3 text-lg',
  };

  const variantClasses = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500 dark:bg-primary-500 dark:hover:bg-primary-600',
    secondary: 'bg-secondary-600 hover:bg-secondary-700 text-white focus:ring-secondary-500 dark:bg-secondary-500 dark:hover:bg-secondary-600',
    text: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500 dark:text-gray-300 dark:hover:bg-gray-800',
    danger: 'bg-danger-600 hover:bg-danger-700 text-white focus:ring-danger-500 dark:bg-danger-500 dark:hover:bg-danger-600',
    ghost: 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200',
    icon: 'text-gray-600 hover:bg-gray-100 active:bg-gray-200 focus:ring-gray-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:active:bg-gray-600',
  };

  // 当只有图标时，调整为正方形
  // ghost 和 icon 变体不需要额外的 padding，ghost 保持无样式，icon 已经在 sizeClasses 中处理
  const iconOnlyClass = props.icon && !props.label && props.variant !== 'ghost' && props.variant !== 'icon' ? 'p-2' : '';

  return `${base} ${sizeClasses[props.size]} ${variantClasses[props.variant]} ${iconOnlyClass}`;
});
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="buttonClasses">
    <slot>
      <i v-if="icon && !loading" :class="[icon, { 'mr-2': label }]"></i>
      <i v-if="loading" :class="['pi pi-spin pi-spinner', { 'mr-2': label }]"></i>
      {{ label }}
    </slot>
  </button>
</template>
