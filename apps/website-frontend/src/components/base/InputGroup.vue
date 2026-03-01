<script setup lang="ts">
/**
 * 输入组组件
 * 使用 Tailwind CSS 样式
 * 将多个输入框和附加元素组合在一起
 */
import { ref, provide } from 'vue';

interface Props {
  /** 是否禁用 */
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  disabled: false,
});

/** 焦点状态 */
const isFocused = ref(false);

/** 提供标识和状态，让子组件知道它们在 InputGroup 中 */
provide('inInputGroup', true);
provide('inputGroupFocused', isFocused);

/** 处理焦点变化 */
const handleFocus = () => {
  isFocused.value = true;
};

const handleBlur = () => {
  isFocused.value = false;
};
</script>

<template>
  <div
    class="flex items-stretch w-full *:first:rounded-l-lg *:first:rounded-r-none *:last:rounded-r-lg *:last:rounded-l-none [&>:not(:last-child)]:border-r-0"
    @focusin="handleFocus"
    @focusout="handleBlur">
    <slot />
  </div>
</template>
