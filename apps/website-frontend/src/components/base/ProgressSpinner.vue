<script setup lang="ts">
/**
 * 加载动画组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Props {
  /** 大小 */
  size?: 'small' | 'normal' | 'large';
  /** 描边宽度 */
  strokeWidth?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'normal',
  strokeWidth: '4',
});

const sizeClasses = computed(() => {
  const sizes = {
    small: 'w-8 h-8',
    normal: 'w-16 h-16',
    large: 'w-24 h-24',
  };
  return sizes[props.size];
});
</script>

<template>
  <div :class="['inline-block', sizeClasses]">
    <svg
      class="animate-spin text-primary-500 dark:text-primary-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24">
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        :stroke-width="strokeWidth"
        stroke="currentColor"></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  </div>
</template>
