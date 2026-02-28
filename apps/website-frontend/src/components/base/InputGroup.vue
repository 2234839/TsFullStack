<script setup lang="ts">
/**
 * 输入组组件
 * 使用 Tailwind CSS 样式
 */
interface Props {
  /** 是否禁用 */
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  disabled: false,
});
</script>

<template>
  <div class="flex items-stretch w-full">
    <slot />
  </div>
</template>
