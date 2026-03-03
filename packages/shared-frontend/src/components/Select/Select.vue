<script setup lang="ts">
/**
 * 基于 reka-ui 的 Select 组件
 * 提供类型安全的选择器功能
 *
 * @example
 * ```vue
 * <Select
 *   v-model="selectedValue"
 *   :options="[
 *     { value: 'apple', label: '苹果' },
 *     { value: 'banana', label: '香蕉' },
 *   ]"
 *   placeholder="请选择水果"
 *   size="md"
 * />
 * ```
 */
import { computed } from 'vue';
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui';
import type { UiSelectEmits, UiSelectProps } from './types';

/** 定义 props */
const props = withDefaults(defineProps<UiSelectProps>(), {
  placeholder: '请选择',
  side: () => 'bottom' as const,
  align: () => 'start' as const,
  sideOffset: 8,
  disabled: false,
  size: 'md',
});

/** 定义 model - 用于 v-model 双向绑定 */
const modelValue = defineModel<string | null>({ default: null });

/** 定义 emits */
const emit = defineEmits<UiSelectEmits>();

/** 处理值变化 */
const handleUpdateValue = (value: string) => {
  modelValue.value = value;
  emit('update:modelValue', value);
};

/** 转换为 reka-ui 需要的格式（不支持 null） */
const rootModelValue = computed(() => modelValue.value || '');

/** 内容区域样式 */
const contentStyle = {
  zIndex: 10001,
  '--reka-select-content-transform-origin': 'var(--reka-popper-transform-origin)',
};

/** 获取当前选中的选项 */
const selectedOption = computed(() => {
  return props.options.find((option) => option.value === modelValue.value);
});

/** Trigger 尺寸样式类 */
const triggerSizeClasses = computed(() => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm min-w-[120px]',
    md: 'px-3 py-2 text-sm min-w-[200px]',
    lg: 'px-4 py-2.5 text-base min-w-[240px]',
  };
  return sizeClasses[props.size];
});

/** 图标尺寸类 */
const iconSizeClasses = computed(() => {
  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };
  return sizeClasses[props.size];
});

/** 选项尺寸样式类 */
const itemSizeClasses = computed(() => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
  };
  return sizeClasses[props.size];
});

/** 指示器尺寸类 */
const indicatorSizeClasses = computed(() => {
  const sizeClasses = {
    sm: 'w-3.5 h-3.5 left-1.5',
    md: 'w-4 h-4 left-2',
    lg: 'w-5 h-5 left-2.5',
  };
  return sizeClasses[props.size];
});

/** 选项文本左边距 */
const itemTextPlClass = computed(() => {
  const sizeClasses = {
    sm: 'pl-5',
    md: 'pl-6',
    lg: 'pl-7',
  };
  return sizeClasses[props.size];
});
</script>

<template>
  <SelectRoot
    :model-value="rootModelValue"
    :disabled="disabled"
    @update:model-value="handleUpdateValue">
    <SelectTrigger
      class="inline-flex items-center justify-between border border-primary-300 dark:border-primary-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-primary-50 dark:bg-primary-950 text-primary-900 dark:text-primary-100 cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors"
      :class="triggerSizeClasses"
      :data-placeholder="!selectedOption">
      <SelectValue
        class="flex-1"
        :placeholder="placeholder">
        {{ selectedOption?.label || placeholder }}
      </SelectValue>
      <svg
        class="ml-2 text-primary-400 transition-transform duration-200 shrink-0"
        :class="[iconSizeClasses, { 'rotate-180': $attrs['data-state'] === 'open' }]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7" />
      </svg>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        :collision-padding="16"
        :avoid-collisions="true"
        class="bg-primary-50 dark:bg-primary-950 text-primary-900 dark:text-primary-100 rounded-md shadow-lg min-w-[var(--reka-select-trigger-width)] max-w-[calc(100vw-32px)] z-[10001] animate-in fade-in zoom-in-95 duration-200"
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        :style="contentStyle">
        <SelectScrollUpButton
          class="flex items-center justify-center bg-primary-50 dark:bg-primary-950 text-primary-900 dark:text-primary-100 cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-800 transition-colors"
          :class="props.size === 'sm' ? 'h-5' : props.size === 'lg' ? 'h-7' : 'h-6'">
          <svg
            :class="iconSizeClasses"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 15l7-7 7 7" />
          </svg>
        </SelectScrollUpButton>

        <SelectViewport :class="props.size === 'sm' ? 'p-0.5' : props.size === 'lg' ? 'p-1.5' : 'p-1'">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            :disabled="option.disabled"
            class="relative flex items-center rounded-md cursor-pointer select-none data-[highlighted]:bg-primary-200 dark:data-[highlighted]:bg-primary-800 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed transition-colors"
            :class="itemSizeClasses">
            <SelectItemIndicator
              class="absolute flex items-center justify-center text-primary-600 dark:text-primary-400"
              :class="indicatorSizeClasses">
              <svg
                :class="iconSizeClasses"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7" />
              </svg>
            </SelectItemIndicator>

            <SelectItemText :class="itemTextPlClass">
              {{ option.label }}
            </SelectItemText>
          </SelectItem>
        </SelectViewport>

        <SelectScrollDownButton
          class="flex items-center justify-center bg-primary-50 dark:bg-primary-950 text-primary-900 dark:text-primary-100 cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-800 transition-colors"
          :class="props.size === 'sm' ? 'h-5' : props.size === 'lg' ? 'h-7' : 'h-6'">
          <svg
            :class="iconSizeClasses"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7" />
          </svg>
        </SelectScrollDownButton>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<style>
/* 不再需要自定义样式，全部使用 Tailwind CSS */
</style>
