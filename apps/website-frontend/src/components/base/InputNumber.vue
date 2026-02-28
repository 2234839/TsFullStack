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

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  step: 1,
  minFractionDigits: 0,
  maxFractionDigits: undefined,
  showButtons: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: number | null];
}>();

/** 输入框样式类 */
const inputClasses = computed(() => {
  const base = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-200';

  const stateClasses = 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400';

  const bgClass = 'bg-white dark:bg-gray-800';
  const textClass = 'text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500';
  const disabledClass = props.disabled ? 'opacity-50 cursor-not-allowed' : '';

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
  if (props.disabled) return;
  const current = props.modelValue ?? props.min ?? 0;
  const newValue = current - props.step;
  if (props.min === undefined || newValue >= props.min) {
    emit('update:modelValue', newValue);
  }
}

/** 增加值 */
function increment() {
  if (props.disabled) return;
  const current = props.modelValue ?? props.min ?? 0;
  const newValue = current + props.step;
  if (props.max === undefined || newValue <= props.max) {
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
        class="w-6 h-6 flex items-center justify-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
        <i class="pi pi-chevron-up text-xs"></i>
      </button>
      <button
        @click="decrement"
        :disabled="disabled"
        class="w-6 h-6 flex items-center justify-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
        <i class="pi pi-chevron-down text-xs"></i>
      </button>
    </div>
  </div>
</template>
