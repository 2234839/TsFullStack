<script setup lang="ts">
/**
 * 下拉选择组件
 * 使用原生 select 元素和 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Option {
  label: string;
  value: any;
  disabled?: boolean;
}

interface Props {
  /** 模型值 */
  modelValue?: any;
  /** 选项列表 */
  options?: Option[];
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 错误状态 */
  invalid?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  invalid: false,
  options: () => [],
});

const emit = defineEmits<{
  'update:modelValue': [value: any];
}>();

/** 选择框样式类 */
const selectClasses = computed(() => {
  const base = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-200 bg-white dark:bg-gray-800 cursor-pointer';

  const stateClasses = props.invalid
    ? 'border-danger-500 focus:ring-red-500 dark:border-danger-400'
    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400';

  const textClass = 'text-gray-900 dark:text-gray-100';
  const disabledClass = props.disabled ? 'opacity-50 cursor-not-allowed' : '';

  return `${base} ${stateClasses} ${textClass} ${disabledClass}`;
});

/** 处理选择事件 */
function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <select
    :disabled="disabled"
    :value="modelValue"
    @change="handleChange"
    :class="selectClasses">
    <option v-if="placeholder && !modelValue" value="" disabled>
      {{ placeholder }}
    </option>
    <option
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :disabled="option.disabled">
      {{ option.label }}
    </option>
  </select>
</template>
