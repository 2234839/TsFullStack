<script setup lang="ts">
/**
 * 数字输入框组件（基于 reka-ui NumberField 无头 primitives）
 * 输入解析/上下限/步进由 NumberField 处理，保留原 props/emits API
 */
import { computed } from 'vue';
import { NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput, NumberFieldRoot } from 'reka-ui';
import { INPUT_BASE_CLASSES } from './inputStyles';

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

const {
  disabled = false,
  step = 1,
  min,
  max,
  minFractionDigits = 0,
  maxFractionDigits,
  showButtons = false,
} = defineProps<Props>();
defineOptions({ inheritAttrs: false });

const emit = defineEmits<{
  'update:modelValue': [value: number | null];
}>();

/** 输入框样式类（与 Input 统一配色；带步进按钮时右侧圆角交给按钮组） */
const inputClasses = computed(() => {
  const stateClasses =
    'border-primary-default focus:border-primary-500 focus:ring-primary-500 dark:focus:border-primary-400 dark:focus:ring-primary-400';

  const bgClass = 'bg-primary-card';
  const textClass = 'text-primary-title placeholder-primary-400 dark:placeholder-primary-500';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';
  const groupClass = showButtons ? 'flex-1 rounded-r-none border-r-0' : '';

  return `${INPUT_BASE_CLASSES} ${groupClass} ${stateClasses} ${bgClass} ${textClass} ${disabledClass}`;
});

/** 步进按钮样式类（上下均分按钮组高度，与输入框连成一体） */
const buttonClasses =
  'flex flex-1 items-center justify-center bg-primary-card hover:bg-primary-100 dark:hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed';

/** 数值格式化选项（控制允许输入与显示的小数位） */
const formatOptions = computed(() => ({
  minimumFractionDigits: minFractionDigits,
  maximumFractionDigits: maxFractionDigits ?? Math.max(minFractionDigits, 2),
}));
</script>

<template>
  <NumberFieldRoot
    class="flex"
    :model-value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :format-options="formatOptions"
    @update:model-value="emit('update:modelValue', $event ?? null)"
  >
    <NumberFieldInput v-bind="$attrs" :placeholder="placeholder" :class="inputClasses" />
    <div
      v-if="showButtons"
      class="flex w-6 flex-col rounded-r-lg border border-primary-default dark:border-primary-default"
    >
      <NumberFieldIncrement :class="`${buttonClasses} rounded-tr-lg border-b border-primary-default dark:border-primary-default`" aria-label="Increase">
        <i class="pi pi-chevron-up text-xs"></i>
      </NumberFieldIncrement>
      <NumberFieldDecrement :class="`${buttonClasses} rounded-br-lg`" aria-label="Decrease">
        <i class="pi pi-chevron-down text-xs"></i>
      </NumberFieldDecrement>
    </div>
  </NumberFieldRoot>
</template>
