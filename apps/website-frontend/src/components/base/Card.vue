<script setup lang="ts">
/**
 * 卡片组件
 * 使用 Tailwind CSS 样式
 * 支持具名插槽：title 和 content
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
    class="bg-primary-50 dark:bg-primary-950 rounded-lg shadow-md overflow-hidden"
    :class="{ 'cursor-pointer hover:shadow-lg transition-shadow duration-300': clickable }">
    <!-- 具名插槽：标题区域 -->
    <div v-if="$slots.title" class="p-4 border-b border-primary-200 dark:border-primary-700">
      <slot name="title" />
    </div>

    <!-- 具名插槽：内容区域 -->
    <div v-if="$slots.content" class="p-4">
      <slot name="content" />
    </div>

    <!-- 默认插槽（向后兼容） -->
    <slot v-if="!$slots.title && !$slots.content" />
  </div>
</template>
