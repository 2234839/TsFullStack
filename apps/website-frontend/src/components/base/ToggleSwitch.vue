<script setup lang="ts">
/**
 * 切换开关组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Props {
  /** 模型值 */
  modelValue?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

/** 处理切换 */
function toggle() {
  if (!props.disabled) {
    emit('update:modelValue', !props.modelValue);
  }
}

/** 开关样式类 */
const switchClasses = computed(() => {
  const base = 'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
  const activeClass = props.modelValue
    ? 'bg-primary-600 dark:bg-primary-500'
    : 'bg-gray-300 dark:bg-gray-600';
  const disabledClass = props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

  return `${base} ${activeClass} ${disabledClass}`;
});

/** 滑块样式类 */
const sliderClasses = computed(() => {
  const base = 'inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out';
  const translateClass = props.modelValue ? 'translate-x-6' : 'translate-x-1';

  return `${base} ${translateClass}`;
});
</script>

<template>
  <div :class="switchClasses" @click="toggle">
    <span :class="sliderClasses" />
  </div>
</template>
