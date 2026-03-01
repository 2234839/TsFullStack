<script setup lang="ts">
/**
 * 输入组附加组件
 * 使用 Tailwind CSS 样式
 */
import { computed, inject } from 'vue';

interface Props {
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否可点击 */
  clickable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  clickable: false,
});

/** 从 InputGroup 获取焦点状态 */
const inputGroupFocused = inject('inputGroupFocused', { value: false });

const addonClasses = computed(() => {
  const base = 'px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 flex items-center justify-center min-w-[40px] transition-colors rounded-none';

  // 当 InputGroup 中有元素获得焦点时，Addon 的边框也要高亮
  const focusClass = inputGroupFocused.value
    ? 'border-primary-500 dark:border-primary-400'
    : '';

  const disabledClass = props.disabled ? 'opacity-50 cursor-not-allowed' : '';
  // 只有可点击时才有 hover 效果
  const hoverClass = !props.disabled && props.clickable ? 'hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer' : '';

  return `${base} ${focusClass} ${disabledClass} ${hoverClass}`;
});
</script>

<template>
  <div :class="addonClasses" @click="$emit('click', $event)">
    <slot />
  </div>
</template>
