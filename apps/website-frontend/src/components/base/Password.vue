<script setup lang="ts">
/**
 * 密码输入框组件
 * 使用 Tailwind CSS 样式
 */
import { ref, computed } from 'vue';

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
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  invalid: false,
  feedback: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

/** 密码可见性 */
const visible = ref(false);

/** 切换密码可见性 */
const toggleVisibility = () => {
  visible.value = !visible.value;
};

/** 输入框样式类 */
const inputClasses = computed(() => {
  const base = 'w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-200';

  const stateClasses = props.invalid
    ? 'border-danger-500 focus:ring-red-500 dark:border-danger-400'
    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400';

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
  <div class="relative">
    <input
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
      class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
      <i :class="visible ? 'pi pi-eye-slash' : 'pi pi-eye'" class="text-lg"></i>
    </button>
  </div>
</template>
