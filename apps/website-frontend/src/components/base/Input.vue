<script setup lang="ts">
/**
 * 输入框组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

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

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  readonly: false,
  invalid: false,
  type: 'text',
});

type ModelValue = string | number;

const emit = defineEmits<{
  'update:modelValue': [value: ModelValue];
}>();


/** 输入框样式类 */
const inputClasses = computed(() => {
  const base = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-200';

  const stateClasses = props.invalid
    ? 'border-danger-500 focus:ring-danger-500 dark:border-danger-400'
    : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500 dark:focus:ring-primary-400';

  const bgClass = 'bg-white dark:bg-gray-800';
  const textClass = 'text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500';
  const disabledClass = props.disabled ? 'opacity-50 cursor-not-allowed' : '';

  return `${base} ${stateClasses} ${bgClass} ${textClass} ${disabledClass}`;
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
