<script setup lang="ts">
/**
 * 输入框组件
 * 使用 Tailwind CSS 样式
 */
import { computed, inject } from 'vue';
import { INPUT_BASE_CLASSES } from './inputStyles';

interface Props {
  /** 模型值 */
  modelValue?: string | number;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只读 */
  readonly?: boolean;
  /** 错误状态 */
  invalid?: boolean;
  /** 输入框类型 */
  type?: 'text' | 'email' | 'number' | 'tel' | 'url';
}

const { disabled = false, readonly = false, invalid = false, type = 'text' } = defineProps<Props>();

type ModelValue = string | number;

const emit = defineEmits<{
  'update:modelValue': [value: ModelValue];
}>();

/** 检查是否在 InputGroup 中 */
const inInputGroup = inject('inInputGroup', false);

/** 输入框样式类 */
const inputClasses = computed(() => {
  // 在 InputGroup 中时，不需要圆角和 focus ring（由父容器控制）
  const roundedClass = inInputGroup ? 'rounded-none' : 'rounded-lg';
  const ringClass = inInputGroup ? '' : 'focus:ring-2 focus:ring-offset-0';

  const stateClasses = invalid
    ? 'border-danger-500 focus:border-danger-500 dark:border-danger-400'
    : 'border-primary-200 dark:border-primary-700 focus:border-primary-500 dark:focus:border-primary-400';

  const bgClass = 'bg-primary-50 dark:bg-primary-900';
  const textClass = 'text-primary-900 dark:text-primary-100 placeholder-primary-400 dark:placeholder-primary-500';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return `${INPUT_BASE_CLASSES} ${roundedClass} ${ringClass} ${stateClasses} ${bgClass} ${textClass} ${disabledClass}`;
});

/** 处理输入事件 */
function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <input
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :value="modelValue"
    @input="handleInput"
    :class="inputClasses" />
</template>
