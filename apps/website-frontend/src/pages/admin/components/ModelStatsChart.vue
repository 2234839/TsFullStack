<!-- ABOUTME: Model statistics chart component showing AI model usage trends and distribution -->
<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        {{ $t('请求趋势') }}
      </h3>
      <Chart type="line" :data="lineChartData" :options="chartOptions" />
    </div>

    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        {{ $t('模型分布') }}
      </h3>
      <Chart type="doughnut" :data="doughnutChartData" :options="doughnutOptions" />
    </div>

    <div class="lg:col-span-2 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        {{ $t('详细统计') }}
      </h3>
      <DataTable :value="detailedStats" stripedRows responsiveLayout="scroll">
        <Column field="modelName" :header="$t('模型名称')"></Column>
        <Column field="requestCount" :header="$t('请求数量')"></Column>
        <Column field="successRate" :header="$t('成功率')">
          <template #body="slotProps">
            {{ slotProps.data.successRate }}%
          </template>
        </Column>
        <Column field="avgTokens" :header="$t('平均令牌数')"></Column>
        <Column field="lastUsed" :header="$t('最后使用时间')"></Column>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import Chart from 'primevue/chart'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useAPI } from '@/api'

const { API } = useAPI()

interface DetailedStats {
  modelName: string
  requestCount: number
  successRate: number
  avgTokens: number
  lastUsed: string
}

interface RateLimit {
  id: number
  timestamp: Date
  aiModelId: number
  tokenUsage?: number
  success?: boolean
}

const lineChartData = ref({
  labels: [] as string[],
  datasets: [
    {
      label: '请求数量',
      data: [] as number[],
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.4
    }
  ]
})

const doughnutChartData = ref({
  labels: [] as string[],
  datasets: [
    {
      data: [] as number[],
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(236, 72, 153, 0.8)'
      ]
    }
  ]
})

const detailedStats = ref<DetailedStats[]>([])

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top'
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        precision: 0
      }
    }
  }
}))

const doughnutOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right'
    }
  }
}))

const loadRequestStats = async (timeRange: '24h' | '7d' | '30d' = '24h') => {
  const now = new Date()
  const startTime = new Date(now.getTime() - (timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000)

  // Query rate limits with model information
  const rateLimits = await API.db.apiRateLimit.findMany({
    where: {
      timestamp: {
        gte: startTime
      }
    }
  }) as RateLimit[]

  // Get AI models for mapping
  const aiModels = await API.db.aiModel.findMany() as { id: number; name: string }[]

  // Create model mapping
  const modelMap = new Map<number, { id: number; name: string }>()
  aiModels.forEach(model => {
    modelMap.set(model.id, model)
  })

  // Process data for charts
  const modelStats = new Map<string, {
    count: number
    tokens: number
    success: number
    lastUsed: Date
  }>()

  rateLimits.forEach((rateLimit: RateLimit) => {
    const model = modelMap.get(rateLimit.aiModelId)
    if (!model) return

    const modelName = model.name
    const current = modelStats.get(modelName) || {
      count: 0,
      tokens: 0,
      success: 0,
      lastUsed: new Date(0)
    }

    current.count++
    current.tokens += rateLimit.tokenUsage || 0
    if (rateLimit.success) {
      current.success++
    }
    if (rateLimit.timestamp > current.lastUsed) {
      current.lastUsed = rateLimit.timestamp
    }

    modelStats.set(modelName, current)
  })

  // Update line chart data
  const hourlyData = new Map<number, number>()
  rateLimits.forEach(rateLimit => {
    const hour = new Date(rateLimit.timestamp).getHours()
    hourlyData.set(hour, (hourlyData.get(hour) || 0) + 1)
  })

  lineChartData.value = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        label: '请求数量',
        data: Array.from({ length: 24 }, (_, i) => hourlyData.get(i) || 0),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4
      }
    ]
  }

  // Update doughnut chart data
  const modelNames = Array.from(modelStats.keys())
  const modelCounts = modelNames.map(name => modelStats.get(name)!.count)

  doughnutChartData.value = {
    labels: modelNames,
    datasets: [
      {
        data: modelCounts,
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)'
        ]
      }
    ]
  }

  // Update detailed stats
  detailedStats.value = Array.from(modelStats.entries()).map(([modelName, stats]) => ({
    modelName,
    requestCount: stats.count,
    successRate: stats.count > 0 ? Math.round((stats.success / stats.count) * 100) : 0,
    avgTokens: stats.count > 0 ? Math.round(stats.tokens / stats.count) : 0,
    lastUsed: stats.lastUsed.toLocaleString()
  }))
}

onMounted(() => {
  loadRequestStats()
})

defineExpose({
  loadRequestStats
})
</script>

<style scoped>
.chart-container {
  height: 300px;
}
</style>