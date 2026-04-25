<script setup lang="ts">
/**
 * 密码输入框组件
 * 使用 Tailwind CSS 样式
 */
import { ref, computed } from 'vue';
import { INPUT_BASE_CLASSES } from './inputStyles';

interface Props {
  /** 模型值 */
  modelValue?: string;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 错误状态 */
  invalid?: boolean;
  /** 是否显示强度指示器 */
  feedback?: boolean;
  /** 传入 true 启用内置密码可见性切换，或传入外部切换函数 */
  toggleMask?: boolean | (() => void);
  /** input 元素 id */
  inputId?: string;
}

const { disabled = false, invalid = false, toggleMask: externalToggle, inputId } = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

/** 密码可见性 */
const visible = ref(false);

/** 切换密码可见性（优先使用外部传入的切换函数） */
const toggleVisibility = () => {
  if (typeof externalToggle === 'function') {
    externalToggle();
    return;
  }
  visible.value = !visible.value;
};

/** 输入框样式类 */
const inputClasses = computed(() => {
  const paddingRight = 'pr-10';

  const stateClasses = invalid
    ? 'border-danger-500 focus:ring-danger-500 dark:border-danger-400'
    : 'border-primary-300 dark:border-primary-700 focus:ring-secondary-500 dark:focus:ring-secondary-400';

  const bgClass = 'bg-primary-50 dark:bg-primary-950';
  const textClass = 'text-primary-900 dark:text-primary-100 placeholder-primary-400 dark:placeholder-primary-500';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return `${INPUT_BASE_CLASSES} ${paddingRight} ${stateClasses} ${bgClass} ${textClass} ${disabledClass}`;
});

/** 处理输入事件 */
function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <div class="relative">
    <input
      :id="inputId"
      :type="visible ? 'text' : 'password'"
      :placeholder="placeholder"
      :disabled="disabled"
      :value="modelValue"
      @input="handleInput"
      :class="inputClasses" />
    <button
      type="button"
      @click="toggleVisibility"
      :disabled="disabled"
      class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
      <i :class="visible ? 'pi pi-eye-slash' : 'pi pi-eye'" class="text-lg"></i>
    </button>
  </div>
</template>
