<script setup lang="ts">
/**
 * 数字输入框组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Props {
  /** 模型值 */
  modelValue?: number | null;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
  /** 步长 */
  step?: number;
  /** 小数位数 */
  minFractionDigits?: number;
  /** 最大小数位数 */
  maxFractionDigits?: number;
  /** 是否显示按钮 */
  showButtons?: boolean;
}

const { modelValue, disabled = false, step = 1, min, max, minFractionDigits: _minFractionDigits = 0, maxFractionDigits: _maxFractionDigits = undefined, showButtons = false } = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: number | null];
}>();

/** 输入框样式类 */
const inputClasses = computed(() => {
  const base = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-200';

  const stateClasses = 'border-primary-300 dark:border-primary-700 focus:ring-info-600 dark:focus:ring-info-500';

  const bgClass = 'bg-primary-50 dark:bg-primary-900';
  const textClass = 'text-primary-950 dark:text-primary-50 placeholder-primary-500 dark:placeholder-primary-400';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return `${base} ${stateClasses} ${bgClass} ${textClass} ${disabledClass}`;
});

/** 处理输入事件 */
function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = target.value === '' ? null : parseFloat(target.value);
  if (!isNaN(value ?? NaN)) {
    emit('update:modelValue', value);
  }
}

/** 减少值 */
function decrement() {
  if (disabled) return;
  const current = modelValue ?? min ?? 0;
  const newValue = current - step;
  if (min === undefined || newValue >= min) {
    emit('update:modelValue', newValue);
  }
}

/** 增加值 */
function increment() {
  if (disabled) return;
  const current = modelValue ?? min ?? 0;
  const newValue = current + step;
  if (max === undefined || newValue <= max) {
    emit('update:modelValue', newValue);
  }
}
</script>

<template>
  <div class="relative flex items-center">
    <input
      type="number"
      :placeholder="placeholder"
      :disabled="disabled"
      :value="modelValue"
      @input="handleInput"
      :min="min"
      :max="max"
      :step="step"
      :class="inputClasses" />
    <div v-if="showButtons" class="flex flex-col ml-2 gap-1">
      <button
        @click="increment"
        :disabled="disabled"
        class="w-6 h-6 flex items-center justify-center border border-primary-300 dark:border-primary-700 rounded bg-primary-50 dark:bg-primary-900 hover:bg-primary-100 dark:hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed">
        <i class="pi pi-chevron-up text-xs"></i>
      </button>
      <button
        @click="decrement"
        :disabled="disabled"
        class="w-6 h-6 flex items-center justify-center border border-primary-300 dark:border-primary-700 rounded bg-primary-50 dark:bg-primary-900 hover:bg-primary-100 dark:hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed">
        <i class="pi pi-chevron-down text-xs"></i>
      </button>
    </div>
  </div>
</template>
