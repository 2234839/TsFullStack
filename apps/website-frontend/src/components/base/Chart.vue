<script setup lang="ts">
/**
 * 图表组件
 * 基于 Chart.js 的 Vue 3 包装器
 */
import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { ChartType, ChartData, ChartOptions } from 'chart.js';

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
let chartInstance: any = null;

// 动态导入 Chart.js 以避免 SSR 问题
let Chart: any = null;

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
  if (!ctx) return;

  chartInstance = new Chart(ctx, {
    type: props.type,
    data: props.data,
    options: props.options,
  });
}

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

// 监听数据变化
watch(
  () => [props.data, props.options],
  () => {
    if (chartInstance) {
      chartInstance.data = props.data;
      chartInstance.options = props.options;
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
  chart: chartInstance,
});
</script>

<template>
  <div class="chart-container" style="position: relative; height: 400px; width: 100%">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>
