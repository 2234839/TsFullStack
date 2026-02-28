<script setup lang="ts">
/**
 * 输入组附加组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Props {
  /** 是否禁用 */
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
});

const addonClasses = computed(() => {
  const base = 'px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-r-0 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 flex items-center justify-center min-w-[40px]';
  const disabledClass = props.disabled ? 'opacity-50' : '';
  return `${base} ${disabledClass}`;
});
</script>

<template>
  <div :class="addonClasses">
    <slot />
  </div>
</template>
