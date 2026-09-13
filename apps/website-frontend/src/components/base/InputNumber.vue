<script setup lang="ts">
/**
 * 数字输入框组件（基于 reka-ui NumberField 无头 primitives）
 * 输入解析/上下限/步进由 NumberField 处理，保留原 props/emits API
 */
import { computed } from "vue";
import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot,
} from "reka-ui";
import { INPUT_BASE_CLASSES } from "./inputStyles";

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
  "update:modelValue": [value: number | null];
}>();

/** 输入框样式类 */
const inputClasses = computed(() => {
  const stateClasses =
    "border-primary-300 dark:border-primary-700 focus:ring-info-600 dark:focus:ring-info-500";

  const bgClass = "bg-primary-card";
  const textClass =
    "text-primary-950 dark:text-primary-50 placeholder-primary-500 dark:placeholder-primary-400";
  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "";

  return `${INPUT_BASE_CLASSES} ${stateClasses} ${bgClass} ${textClass} ${disabledClass}`;
});

/** 步进按钮样式类 */
const buttonClasses =
  "w-6 h-6 flex items-center justify-center border border-primary-300 dark:border-primary-700 rounded bg-primary-card hover:bg-primary-100 dark:hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed";

/** 数值格式化选项（控制允许输入与显示的小数位） */
const formatOptions = computed(() => ({
  minimumFractionDigits: minFractionDigits,
  maximumFractionDigits: maxFractionDigits ?? Math.max(minFractionDigits, 2),
}));
</script>

<template>
  <NumberFieldRoot
    :model-value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :format-options="formatOptions"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <NumberFieldInput v-bind="$attrs" :placeholder="placeholder" :class="inputClasses" />
    <div v-if="showButtons" class="ml-2 flex flex-col gap-1">
      <NumberFieldIncrement :class="buttonClasses" aria-label="Increase">
        <i class="pi pi-chevron-up text-xs"></i>
      </NumberFieldIncrement>
      <NumberFieldDecrement :class="buttonClasses" aria-label="Decrease">
        <i class="pi pi-chevron-down text-xs"></i>
      </NumberFieldDecrement>
    </div>
  </NumberFieldRoot>
</template>
