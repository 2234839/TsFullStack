<script setup lang="ts">
/**
 * 文本域组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Props {
  /** 模型值 */
  modelValue?: string;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只读 */
  readonly?: boolean;
  /** 错误状态 */
  invalid?: boolean;
  /** 行数 */
  rows?: number;
  /** 自动调整高度 */
  autoResize?: boolean;
}

const { disabled = false, readonly = false, invalid = false, rows = 3, autoResize = false } = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

/** 输入框样式类 */
const textareaClasses = computed(() => {
  const base = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-200 resize-none';

  const stateClasses = invalid
    ? 'border-danger-500 focus:ring-danger-500 dark:border-danger-400'
    : 'border-primary-200 dark:border-primary-700 focus:ring-primary-500 dark:focus:ring-primary-400';

  const bgClass = 'bg-white dark:bg-primary-900';
  const textClass = 'text-primary-900 dark:text-primary-100 placeholder-primary-400 dark:placeholder-primary-500';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';
  const resizeClass = autoResize ? 'overflow-hidden' : '';

  return `${base} ${stateClasses} ${bgClass} ${textClass} ${disabledClass} ${resizeClass}`;
});

/** 处理输入事件 */
function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <textarea
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :value="modelValue"
    @input="handleInput"
    :class="textareaClasses" />
</template>
