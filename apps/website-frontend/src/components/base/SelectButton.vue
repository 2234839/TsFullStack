<script setup lang="ts">
/**
 * 选择按钮组组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Props {
  /** 模型值 */
  modelValue?: any;
  /** 选项列表 */
  options?: any[];
  /** 选项值的键名 */
  optionLabel?: string;
  /** 选项值的键名 */
  optionValue?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否多选 */
  multiple?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  multiple: false,
  options: () => [],
  optionLabel: 'label',
  optionValue: 'value',
});

const emit = defineEmits<{
  'update:modelValue': [value: any];
}>();

/** 处理选择 */
function handleSelect(value: any) {
  if (props.multiple) {
    const currentArray = Array.isArray(props.modelValue) ? props.modelValue : [];
    if (currentArray.includes(value)) {
      emit('update:modelValue', currentArray.filter((v) => v !== value));
    } else {
      emit('update:modelValue', [...currentArray, value]);
    }
  } else {
    emit('update:modelValue', value);
  }
}

/** 获取选项的显示值 */
function getOptionLabel(option: any): string {
  return typeof option === 'object' ? option[props.optionLabel] : option;
}

/** 获取选项的值 */
function getOptionValue(option: any): any {
  return typeof option === 'object' ? option[props.optionValue] : option;
}

/** 检查选项是否被选中 */
function isSelected(option: any): boolean {
  const value = getOptionValue(option);
  if (props.multiple) {
    return Array.isArray(props.modelValue) && props.modelValue.includes(value);
  }
  return props.modelValue === value;
}

/** 按钮样式类 */
const buttonClasses = (selected: boolean) => {
  return selected
    ? 'px-4 py-2 text-sm font-medium transition-colors duration-200 border bg-primary-600 text-white border-primary-600 dark:bg-primary-500 dark:border-primary-500'
    : 'px-4 py-2 text-sm font-medium transition-colors duration-200 border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700';
};

const containerClasses = computed(() => {
  const base = 'inline-flex rounded-md overflow-hidden border';
  return props.disabled
    ? `${base} border-gray-200 dark:border-gray-700 opacity-50`
    : `${base} border-gray-300 dark:border-gray-600`;
});
</script>

<template>
  <div :class="containerClasses">
    <button
      v-for="(option, index) in options"
      :key="index"
      :disabled="disabled"
      :class="[buttonClasses(isSelected(option)), { 'border-r-0': index < options.length - 1 }]"
      @click="handleSelect(getOptionValue(option))">
      {{ getOptionLabel(option) }}
    </button>
  </div>
</template>
