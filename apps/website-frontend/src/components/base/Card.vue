<script setup lang="ts">
/**
 * 卡片组件
 * 使用 Tailwind CSS 样式
 */
interface Props {
  /** 是否为可点击样式 */
  clickable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  clickable: false,
});
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
    :class="{ 'cursor-pointer hover:shadow-lg transition-shadow duration-300': clickable }">
    <slot />
  </div>
</template>
