<script setup lang="ts">
/**
 * 进度条组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

interface Props {
  /** 进度值 (0-100) */
  value?: number;
  /** 模式 */
  mode?: 'determinate' | 'indeterminate';
  /** 是否显示百分比文本 */
  showValue?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  value: 0,
  mode: 'determinate',
  showValue: false,
});

/** 进度百分比 */
const percentage = computed(() => {
  return Math.max(0, Math.min(100, props.value));
});
</script>

<template>
  <div class="w-full">
    <div class="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <template v-if="mode === 'determinate'">
        <div
          class="h-full bg-primary-500 dark:bg-primary-400 transition-all duration-300 ease-out"
          :style="{ width: `${percentage}%` }" />
      </template>
      <template v-else>
        <div class="absolute top-0 left-0 h-full bg-primary-500 dark:bg-primary-400 animate-progress-indeterminate" />
      </template>
    </div>
    <div v-if="showValue && mode === 'determinate'" class="mt-1 text-center text-sm text-gray-600 dark:text-gray-400">
      {{ percentage }}%
    </div>
  </div>
</template>

<style scoped>
@keyframes progress-indeterminate {
  0% {
    left: -50%;
    width: 30%;
  }
  50% {
    left: 25%;
    width: 50%;
  }
  100% {
    left: 100%;
    width: 30%;
  }
}

.animate-progress-indeterminate {
  animation: progress-indeterminate 1.5s ease-in-out infinite;
}
</style>
