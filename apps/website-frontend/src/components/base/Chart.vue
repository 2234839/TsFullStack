<script setup lang="ts">
/**
 * 图表组件
 * 基于 Chart.js 的 Vue 3 包装器
 */
import { onMounted, onUnmounted, ref, shallowRef, triggerRef, watch } from 'vue';
import type { ChartType, ChartData, ChartOptions, Chart as ChartInstance } from 'chart.js';

interface Props {
  /** 图表类型 */
  type?: ChartType;
  /** 图表数据 */
  data?: ChartData;
  /** 图表选项 */
  options?: ChartOptions;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'bar' as ChartType,
});

const canvasRef = ref<HTMLCanvasElement | null>(null);
let chartInstance: ChartInstance | null = null;
/** 使用 shallowRef + triggerRef 实现响应式暴露 */
const chartRef = shallowRef<ChartInstance | null>(null);

/** 更新 chartRef 并通知 Vue 响应式系统 */
function updateChartRef(instance: ChartInstance | null) {
  chartInstance = instance;
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

  if (chartInstance) {
    chartInstance.destroy();
  }

  const ctx = canvasRef.value.getContext('2d');
  if (!ctx || !Chart) return;

  chartInstance = new Chart(ctx, {
    type: props.type,
    data: props.data ?? { datasets: [] },
    options: props.options ?? {},
  });
  // 通过 updateChartRef 使 defineExpose 的 getter 返回最新实例
  updateChartRef(chartInstance);
}

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    updateChartRef(null);
  }
}

// 监听数据变化
watch(
  () => [props.data, props.options],
  () => {
    if (chartInstance && props.data) {
      chartInstance.data = props.data;
      if (props.options) chartInstance.options = props.options;
      chartInstance.update();
    }
  },
  { deep: true }
);

onMounted(() => {
  initChart();
});

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
  <div class="chart-container relative h-100 w-full">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>
