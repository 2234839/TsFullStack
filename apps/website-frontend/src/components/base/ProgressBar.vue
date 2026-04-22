<script setup lang="ts">
/**
 * 进度条组件
 * 使用 Tailwind CSS 样式
 */
import { computed } from 'vue';

/** 进度条颜色变体 */
type ProgressBarColor =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'amber'
  | 'orange'
  | 'red';

/** 颜色 → Tailwind 类映射 */
const COLOR_CLASSES: Record<ProgressBarColor, { fill: string; track: string }> = {
  primary: { fill: 'bg-primary-700 dark:bg-primary-300', track: 'bg-primary-200 dark:bg-primary-800' },
  success: { fill: 'bg-success-600 dark:bg-success-400', track: 'bg-success-200 dark:bg-success-900' },
  warning: { fill: 'bg-warning-600 dark:bg-warning-400', track: 'bg-warning-200 dark:bg-warning-900' },
  danger: { fill: 'bg-danger-600 dark:bg-danger-400', track: 'bg-danger-200 dark:bg-danger-900' },
  amber: { fill: 'bg-amber-500 dark:bg-amber-400', track: 'bg-amber-200 dark:bg-amber-900' },
  orange: { fill: 'bg-orange-500 dark:bg-orange-400', track: 'bg-orange-200 dark:bg-orange-900' },
  red: { fill: 'bg-red-500 dark:bg-red-400', track: 'bg-red-200 dark:bg-red-900' },
};

interface Props {
  /** 进度值 (0-100) */
  value?: number;
  /** 模式 */
  mode?: 'determinate' | 'indeterminate';
  /** 是否显示百分比文本 */
  showValue?: boolean;
  /** 颜色变体 */
  color?: ProgressBarColor;
}

const props = withDefaults(defineProps<Props>(), {
  value: 0,
  mode: 'determinate',
  showValue: false,
  color: 'primary',
});

/** 进度百分比 */
const percentage = computed(() => {
  return Math.max(0, Math.min(100, props.value));
});

/** 当前颜色的样式类 */
const colorStyle = computed(() => COLOR_CLASSES[props.color]);
</script>

<template>
  <div class="w-full">
    <div :class="['relative w-full h-2 rounded-full overflow-hidden', colorStyle.track]">
      <template v-if="mode === 'determinate'">
        <div
          :class="['h-full transition-all duration-300 ease-out', colorStyle.fill]"
          :style="{ width: `${percentage}%` }" />
      </template>
      <template v-else>
        <div :class="['absolute top-0 left-0 h-full animate-progress-indeterminate', colorStyle.fill]" />
      </template>
    </div>
    <div v-if="showValue && mode === 'determinate'" class="mt-1 text-center text-sm text-primary-600 dark:text-primary-400">
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
