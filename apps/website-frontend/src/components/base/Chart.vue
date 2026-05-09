<script setup lang="ts">
/**
 * 图表组件
 * 基于 Chart.js 的 Vue 3 包装器
 */
import { onMounted, onUnmounted, ref, shallowRef, triggerRef, watch } from 'vue';
import type { ChartType, ChartData, ChartOptions, Chart as ChartInstance } from 'chart.js';

defineOptions({ inheritAttrs: false });

interface Props {
  /** 图表类型 */
  type?: ChartType;
  /** 图表数据 */
  data?: ChartData;
  /** 图表选项 */
  options?: ChartOptions;
}

const { type = 'bar' as ChartType, data, options } = defineProps<Props>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const chartInstance = ref<ChartInstance | null>(null);
/** 使用 shallowRef + triggerRef 实现响应式暴露 */
const chartRef = shallowRef<ChartInstance | null>(null);

/** 更新 chartRef 并通知 Vue 响应式系统 */
function updateChartRef(instance: ChartInstance | null) {
  chartInstance.value = instance;
  chartRef.value = instance;
  triggerRef(chartRef);
}

// 动态导入 Chart.js 以避免 SSR 问题
let Chart: typeof import('chart.js/auto').default | null = null;

async function loadChart() {
  if (!Chart) {
    Chart = (await import('chart.js/auto')).default;
  }
}

async function initChart() {
  if (!canvasRef.value) return;

  await loadChart();

  if (chartInstance.value) {
    chartInstance.value.destroy();
  }

  const ctx = canvasRef.value.getContext('2d');
  if (!ctx || !Chart) return;

  chartInstance.value = new Chart(ctx, {
    type,
    data: data ?? { datasets: [] },
    options: options ?? {},
  });
  // 通过 updateChartRef 使 defineExpose 的 getter 返回最新实例
  // @ts-expect-error Chart.js 类型比较过于复杂
  updateChartRef(chartInstance.value);
}

function destroyChart() {
  if (chartInstance.value) {
    chartInstance.value.destroy();
    updateChartRef(null);
  }
}

// 监听 props 引用变化（不使用 deep，父组件替换 data/options 引用时触发更新）
watch(
  () => [data, options] as const,
  ([newData, newOptions]) => {
    if (chartInstance.value && newData) {
      chartInstance.value.data = newData;
      if (newOptions) chartInstance.value.options = newOptions;
      chartInstance.value.update();
    }
  },
);

onMounted(initChart);

onUnmounted(() => {
  destroyChart();
});

// 暴露图表实例
defineExpose({
  /** shallowRef + triggerRef 实现响应式暴露，父组件通过 ref.chart 可获取最新实例 */
  get chart() { return chartRef.value; },
});
</script>

<template>
  <div v-bind="$attrs" class="chart-container relative h-100 w-full">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>
