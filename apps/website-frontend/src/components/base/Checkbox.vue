<script setup lang="ts">
/**
 * 复选框组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Props {
  /** 模型值 */
  modelValue?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 二进制框样式 */
  binary?: boolean;
  /** 复选框值 */
  value?: any;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  binary: true,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

/** 盒子样式类 */
const boxClasses = computed(() => {
  const base = 'flex items-center justify-center w-5 h-5 border rounded transition-all duration-200 cursor-pointer';

  const checkedClasses = props.modelValue
    ? 'bg-primary-600 dark:bg-primary-500 border-primary-600 dark:border-primary-500'
    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500';

  const disabledClass = props.disabled ? 'opacity-50 cursor-not-allowed' : '';

  return `${base} ${checkedClasses} ${disabledClass}`;
});

/** 容器样式类 */
const containerClasses = computed(() => {
  return props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';
});

/** 处理点击事件 */
function handleClick() {
  if (!props.disabled) {
    emit('update:modelValue', !props.modelValue);
  }
}
</script>

<template>
  <div :class="containerClasses" @click="handleClick">
    <div :class="boxClasses">
      <i v-if="modelValue" class="pi pi-check text-white text-sm"></i>
    </div>
    <slot />
  </div>
</template>
