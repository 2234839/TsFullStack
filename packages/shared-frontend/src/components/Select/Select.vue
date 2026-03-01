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
</script>

<template>
  <SelectRoot
    :model-value="rootModelValue"
    :disabled="disabled"
    @update:model-value="handleUpdateValue">
    <SelectTrigger
      class="inline-flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 min-w-[200px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      :data-placeholder="!selectedOption">
      <SelectValue
        class="text-sm"
        :placeholder="placeholder">
        {{ selectedOption?.label || placeholder }}
      </SelectValue>
      <span class="ml-2 text-gray-400">
        <svg
          class="w-4 h-4 transition-transform duration-200"
          :class="{ 'rotate-180': $attrs['data-state'] === 'open' }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        :collision-padding="16"
        :avoid-collisions="true"
        class="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-lg min-w-[var(--reka-select-trigger-width)] max-w-[calc(100vw-32px)] z-[10001] animate-in fade-in zoom-in-95 duration-200"
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        :style="contentStyle">
        <SelectScrollUpButton
          class="flex items-center justify-center h-6 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
          <svg
            class="w-4 h-4"
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

        <SelectViewport class="p-1">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            :disabled="option.disabled"
            class="relative flex items-center px-3 py-2 text-sm rounded-md cursor-pointer select-none data-[highlighted]:bg-primary-50 dark:data-[highlighted]:bg-primary-950 data-[highlighted]:text-primary-900 dark:data-[highlighted]:text-primary-100 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed transition-colors">
            <SelectItemIndicator
              class="absolute left-2 w-4 h-4 flex items-center justify-center text-primary-600 dark:text-primary-400">
              <svg
                class="w-4 h-4"
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

            <SelectItemText class="pl-6">
              {{ option.label }}
            </SelectItemText>
          </SelectItem>
        </SelectViewport>

        <SelectScrollDownButton
          class="flex items-center justify-center h-6 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
          <svg
            class="w-4 h-4"
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
