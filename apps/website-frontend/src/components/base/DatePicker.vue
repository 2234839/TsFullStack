<script setup lang="ts">
/**
 * 日期选择器组件
 * 使用原生 datetime-local 输入和 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Props {
  /** 模型值 */
  modelValue?: Date | string | null;
  /** 是否显示时间 */
  showTime?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 日期格式 */
  dateFormat?: string;
  /** 小时格式 */
  hourFormat?: '12' | '24';
}

const props = withDefaults(defineProps<Props>(), {
  showTime: true,
  disabled: false,
  dateFormat: 'yy/mm/dd',
  hourFormat: '24',
});

const emit = defineEmits<{
  'update:modelValue': [value: Date | string | null];
  'show': [];
  'hide': [];
}>();

/** 格式化日期为 datetime-local 输入格式 */
function formatDateForInput(value: Date | string | null | undefined): string {
  if (!value) return '';

  const date = typeof value === 'string' ? new Date(value) : value;

  if (isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  if (props.showTime) {
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  return `${year}-${month}-${day}`;
}

/** 从输入解析日期 */
function parseDateFromInput(value: string): Date | null {
  if (!value) return null;

  const date = new Date(value);
  if (isNaN(date.getTime())) return null;

  return date;
}

/** 处理输入事件 */
function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = target.value;

  if (!value) {
    emit('update:modelValue', null);
    return;
  }

  const date = parseDateFromInput(value);
  emit('update:modelValue', date);
}

/** 处理焦点事件 */
function handleFocus() {
  emit('show');
}

function handleBlur() {
  emit('hide');
}

/** 输入框样式类 */
const inputClasses = computed(() => {
  const base = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-200 bg-white dark:bg-gray-800';

  const stateClasses = 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400';

  const textClass = 'text-gray-900 dark:text-gray-100';
  const disabledClass = props.disabled ? 'opacity-50 cursor-not-allowed' : '';

  return `${base} ${stateClasses} ${textClass} ${disabledClass}`;
});
</script>

<template>
  <input
    type="datetime-local"
    :disabled="disabled"
    :value="formatDateForInput(modelValue)"
    @input="handleInput"
    @focus="handleFocus"
    @blur="handleBlur"
    :class="inputClasses" />
</template>
