<template>
  <div :class="marginClass">
    <div :class="[
      'flex items-center gap-2 font-bold text-primary-900 dark:text-primary-100',
      size === 'large' ? 'text-3xl' : 'text-2xl',
    ]">
      <i v-if="icon" :class="icon" />
      <slot />
    </div>
    <p v-if="subtitle" class="mt-2 text-primary-600 dark:text-primary-400">
      {{ subtitle }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  /** 标题左侧图标（如 'pi pi-list'） */
  icon?: string;
  /** 标题下方的描述文字 */
  subtitle?: string;
  /** 尺寸：large 使用 text-3xl + mb-8，small 使用 text-2xl + mb-6 */
  size?: 'large' | 'small';
  /** 是否禁用底部间距（嵌套在 flex 行中时使用） */
  noMargin?: boolean;
}

const { size = 'small', noMargin = false } = defineProps<Props>();

const marginClass = computed(() => {
  if (noMargin) return '';
  return size === 'large' ? 'mb-8' : 'mb-6';
});
</script>
