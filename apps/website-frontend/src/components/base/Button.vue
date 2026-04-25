<script setup lang="ts">
/**
 * 基础按钮组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Props {
  /** 按钮类型 */
  variant?: 'primary' | 'secondary' | 'text' | 'danger' | 'ghost' | 'icon' | 'text-button';
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

/** 按钮变体样式映射（静态常量，不依赖 props） */
const VARIANT_CLASSES: Record<string, string> = {
  primary: 'bg-primary-900 hover:bg-primary-950 text-white focus:ring-primary-700 dark:bg-primary-50 dark:hover:bg-primary-100 dark:text-primary-950 dark:focus:ring-primary-300',
  secondary: 'bg-secondary-700 hover:bg-secondary-800 text-white focus:ring-secondary-500 dark:bg-secondary-600 dark:hover:bg-secondary-700',
  text: 'text-primary-700 hover:bg-primary-50 focus:ring-primary-500 dark:text-primary-300 dark:hover:bg-primary-800',
  danger: 'bg-danger-600 hover:bg-danger-700 text-white focus:ring-danger-500 dark:bg-danger-500 dark:hover:bg-danger-600',
  ghost: 'text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-200',
  icon: 'text-primary-600 hover:bg-primary-100 active:bg-primary-200 focus:ring-primary-500 dark:text-primary-400 dark:hover:bg-primary-800 dark:active:bg-primary-700',
  'text-button': 'text-primary-600 hover:bg-primary-100 active:bg-primary-200 focus:ring-primary-500 dark:text-primary-400 dark:hover:bg-primary-800 dark:active:bg-primary-700',
};

/** text-button 变体的尺寸映射 */
const TEXT_BUTTON_SIZE: Record<string, string> = {
  sm: 'px-2 py-1 text-sm',
  small: 'px-2 py-1 text-sm',
  md: 'px-3 py-1.5 text-base',
  lg: 'px-4 py-2 text-lg',
};

/** 常规按钮尺寸映射 */
const DEFAULT_SIZE: Record<string, string> = {
  small: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

const { variant = 'primary', size = 'md', disabled = false, type = 'button', loading = false, rounded = false, label, icon } = defineProps<Props>();

/** 按钮样式类 */
const buttonClasses = computed(() => {
  const baseFontClass = variant === 'ghost' || variant === 'text-button' ? 'font-normal' : 'font-medium';
  const borderRadius = rounded ? 'rounded-full' : 'rounded-md';
  const base = `inline-flex items-center justify-center ${borderRadius} ${baseFontClass} transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`;

  const hasLabel = !!label;

  /** 根据变体和尺寸获取尺寸类名 */
  const getSizeClass = (): string => {
    if (variant === 'ghost') return size === 'lg' ? 'text-lg' : size === 'md' ? 'text-base' : 'text-sm';
    if (variant === 'text-button') return TEXT_BUTTON_SIZE[size] ?? 'text-sm';
    if (variant === 'icon') return hasLabel
      ? (DEFAULT_SIZE[size] ?? 'px-3 py-1.5 text-sm')
      : { sm: 'p-1.5 text-sm', small: 'p-1.5 text-sm', md: 'p-2 text-base', lg: 'p-3 text-lg' }[size] ?? 'p-2 text-base';
    return DEFAULT_SIZE[size] ?? 'px-3 py-1.5 text-sm';
  };

  const iconOnlyClass = icon && !label && variant !== 'ghost' && variant !== 'icon' && variant !== 'text-button' ? 'p-2' : '';

  return `${base} ${getSizeClass()} ${VARIANT_CLASSES[variant]} ${iconOnlyClass}`;
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
