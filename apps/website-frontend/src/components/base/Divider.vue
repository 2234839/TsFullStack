<script setup lang="ts">
/**
 * 分割线组件
 * 使用 Tailwind CSS 样式
 */
interface Props {
  /** 对齐方式 */
  align?: 'left' | 'center' | 'right';
  /** 分割线类型 */
  type?: 'horizontal' | 'vertical';
}

withDefaults(defineProps<Props>(), {
  align: 'left',
  type: 'horizontal',
});
</script>

<template>
  <div
    v-if="type === 'horizontal'"
    class="relative flex items-center py-4"
    :class="{
      'justify-start': align === 'left',
      'justify-center': align === 'center',
      'justify-end': align === 'right',
    }">
    <div class="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
    <span v-if="$slots.default" class="flex-shrink-0 mx-4 text-gray-500 dark:text-gray-400">
      <slot />
    </span>
    <div class="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
  </div>

  <div v-else class="h-full border-l border-gray-300 dark:border-gray-600"></div>
</template>
