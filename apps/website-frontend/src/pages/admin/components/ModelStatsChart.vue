<!-- ABOUTME: Model statistics chart component showing AI model usage trends and distribution -->
<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div class="bg-white dark:bg-primary-800 p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-4 text-primary-900 dark:text-white">
        {{ t('请求趋势') }}
      </h3>
      <Chart type="line" :data="lineChartData" :options="chartOptions" />
    </div>

    <div class="bg-white dark:bg-primary-800 p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-4 text-primary-900 dark:text-white">
        {{ t('用户活跃度') }}
      </h3>
      <Chart type="bar" :data="userActivityData" :options="barOptions" />
    </div>

    <div class="bg-white dark:bg-primary-800 p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-4 text-primary-900 dark:text-white">
        {{ t('模型分布') }}
      </h3>
      <Chart type="doughnut" :data="doughnutChartData" :options="doughnutOptions" />
    </div>

    <div class="bg-white dark:bg-primary-800 p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-4 text-primary-900 dark:text-white">
        {{ t('用户排行') }}
      </h3>
      <DataTable :data="userStats" :columns="userStatsColumns" rowKey="userEmail" striped bordered />

      <!-- Pagination controls -->
      <div v-if="userPagination.total > 0" class="mt-4">
        <Paginator
          :rows="userPagination.total"
          :rows-per-page="userPagination.pageSize"
          :page="userPagination.page"
          @update:page="changeUserPage"
        />
      </div>
    </div>

    <div class="lg:col-span-2 bg-white dark:bg-primary-800 p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-4 text-primary-900 dark:text-white">
        {{ t('详细统计') }}
      </h3>
      <DataTable :data="detailedStats" :columns="detailedStatsColumns" rowKey="modelName" striped bordered />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Chart, DataTable } from '@/components/base'
import Paginator from '@/components/base/Paginator.vue'
import { useAPI } from '@/api'
import { useI18n } from '@/composables/useI18n'
import { ONE_DAY_MS } from '@/utils/format'

const { API } = useAPI()
const { t } = useI18n()

/** 图表颜色常量（与 Tailwind 调色板一致） */
const CHART_COLORS = {
  /** indigo - 主色调 */
  primary: 'rgb(99, 102, 241)',
  primaryBg: 'rgba(99, 102, 241, 0.1)',
  primaryFill: 'rgba(99, 102, 241, 0.8)',
  /** emerald - 成功/正确 */
  success: 'rgb(16, 185, 129)',
  successFill: 'rgba(16, 185, 129, 0.8)',
  /** amber - 警告 */
  warning: 'rgb(245, 158, 11)',
  warningFill: 'rgba(245, 158, 11, 0.8)',
  /** red - 错误/危险 */
  danger: 'rgb(239, 68, 68)',
  dangerFill: 'rgba(239, 68, 68, 0.8)',
  /** gray - 中性/默认 */
  gray: 'rgb(107, 114, 128)',
  grayFill: 'rgba(107, 114, 128, 0.8)',
} as const

/** 饼图配色（6色循环） */
const DOUGHNUT_COLORS = [
  CHART_COLORS.primaryFill,
  CHART_COLORS.successFill,
  CHART_COLORS.warningFill,
  CHART_COLORS.dangerFill,
  CHART_COLORS.grayFill,
  'rgba(236, 72, 153, 0.8)',
]

/**
 * 批量获取用户信息（分块查询避免超大查询）
 */
async function batchFetchUsers(userIds: string[]): Promise<Map<string, { id: string; email: string }>> {
  const userMap = new Map<string, { id: string; email: string }>()
  if (userIds.length === 0) return userMap

  const chunkSize = 100
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize)
    const users = await API.db.user.findMany({
      where: { id: { in: chunk } },
      select: { id: true, email: true },
    }) as { id: string; email: string }[]

    for (const user of users) {
      userMap.set(user.id, user)
    }
  }
  return userMap
}

interface DetailedStats {
  modelName: string
  requestCount: number
  successRate: number
  avgTokens: number
  lastUsed: string
}

interface ApiCallLog {
  id: number
  timestamp: Date
  aiModelId: number
  userId?: string
  inputTokens?: number
  outputTokens?: number
  success?: boolean
}

interface UserStat {
  userEmail: string
  requestCount: number
  totalTokens: number
  lastUsed: string
}

const lineChartData = ref({
  labels: [] as string[],
  datasets: [
    {
      label: '请求数量',
      data: [] as number[],
      borderColor: CHART_COLORS.primary,
      backgroundColor: CHART_COLORS.primaryBg,
      tension: 0.4
    }
  ]
})

const doughnutChartData = ref({
  labels: [] as string[],
  datasets: [
    {
      data: [] as number[],
      backgroundColor: DOUGHNUT_COLORS,
    }
  ]
})

const detailedStats = ref<DetailedStats[]>([])
const userStats = ref<UserStat[]>([])

// 用户排行表格列定义
const userStatsColumns = computed(() => [
  { key: 'userEmail', title: t('用户邮箱') },
  { key: 'requestCount', title: t('请求数量') },
  { key: 'totalTokens', title: t('总令牌数') },
  { key: 'lastUsed', title: t('最后使用时间') },
])

// 详细统计表格列定义
const detailedStatsColumns = computed(() => [
  { key: 'modelName', title: t('模型名称') },
  { key: 'requestCount', title: t('请求数量') },
  {
    key: 'successRate',
    title: t('成功率'),
    render: (row: DetailedStats) => `${row.successRate}%`,
  },
  { key: 'avgTokens', title: t('平均令牌数') },
  { key: 'lastUsed', title: t('最后使用时间') },
])
const userActivityData = ref({
  labels: [] as string[],
  datasets: [
    {
      label: '活跃用户数',
      data: [] as number[],
      backgroundColor: CHART_COLORS.successFill,
      borderColor: CHART_COLORS.success,
      borderWidth: 1
    }
  ]
})

const userPagination = ref({
  page: 0,
  pageSize: 10,
  total: 0
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const
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
      position: 'right' as const
    }
  }
}))

const barOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const
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

const changeUserPage = (page: number) => {
  userPagination.value.page = page
  updateUserStatsDisplay()
}

const updateUserStatsDisplay = async () => {
  // Re-process user stats without re-fetching all data
  const now = new Date()
  const startTime = new Date(now.getTime() - ONE_DAY_MS)

  // Query API call logs with model information
  const apiCalls = await API.db.aiCallLog.findMany({
    where: {
      timestamp: {
        gte: startTime
      }
    }
  }) as ApiCallLog[]

  // Get unique user IDs from API calls
  const uniqueUserIds = new Set<string>()
  apiCalls.forEach((apiCall: ApiCallLog) => {
    if (apiCall.userId) {
      uniqueUserIds.add(apiCall.userId)
    }
  })

  // Get users for mapping
  const userMap = await batchFetchUsers(Array.from(uniqueUserIds))

  // Process user data for charts
  const userStatsMap = new Map<string, {
    requestCount: number
    totalTokens: number
    lastUsed: Date
  }>()

  apiCalls.forEach((apiCall: ApiCallLog) => {
    if (apiCall.userId) {
      const user = userMap.get(apiCall.userId)
      if (user) {
        const userStat = userStatsMap.get(user.email) || {
          requestCount: 0,
          totalTokens: 0,
          lastUsed: new Date(0)
        }

        userStat.requestCount++
        userStat.totalTokens += (apiCall.inputTokens || 0) + (apiCall.outputTokens || 0)
        if (apiCall.timestamp > userStat.lastUsed) {
          userStat.lastUsed = apiCall.timestamp
        }

        userStatsMap.set(user.email, userStat)
      }
    }
  })

  // Update user stats with pagination
  const allUserStats = Array.from(userStatsMap.entries())
    .sort((a, b) => b[1].requestCount - a[1].requestCount)

  // Update pagination info
  userPagination.value.total = allUserStats.length

  // Get current page data
  const startIndex = userPagination.value.page * userPagination.value.pageSize
  const endIndex = startIndex + userPagination.value.pageSize
  const paginatedUserStats = allUserStats.slice(startIndex, endIndex)

  userStats.value = paginatedUserStats.map(([userEmail, stats]) => ({
    userEmail,
    requestCount: stats.requestCount,
    totalTokens: stats.totalTokens,
    lastUsed: stats.lastUsed.toLocaleString()
  }))
}

const loadRequestStats = async (timeRange: '24h' | '7d' | '30d' = '24h') => {
  const now = new Date()
  const TIME_RANGE_DAYS: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30 };
  const days = TIME_RANGE_DAYS[timeRange] ?? 1;
  const startTime = new Date(now.getTime() - days * ONE_DAY_MS);

  // Query API call logs with model information
  const apiCalls = await API.db.aiCallLog.findMany({
    where: {
      timestamp: {
        gte: startTime
      }
    }
  }) as ApiCallLog[]

  // Get AI models for mapping
  const aiModels = await API.db.aiModel.findMany() as { id: number; name: string }[]

  // Create model mapping
  const modelMap = new Map<number, { id: number; name: string }>()
  aiModels.forEach(model => {
    modelMap.set(model.id, model)
  })

  // Process user data for charts
  const userStatsMap = new Map<string, {
    requestCount: number
    totalTokens: number
    lastUsed: Date
  }>()

  // Get unique user IDs from API calls
  const uniqueUserIds = new Set<string>()
  apiCalls.forEach((apiCall: ApiCallLog) => {
    if (apiCall.userId) {
      uniqueUserIds.add(apiCall.userId)
    }
  })

  // Create user mapping - only fetch users that actually made calls
  const userMap = await batchFetchUsers(Array.from(uniqueUserIds))

  // Process data for charts
  const modelStats = new Map<string, {
    count: number
    tokens: number
    success: number
    lastUsed: Date
  }>()

  apiCalls.forEach((apiCall: ApiCallLog) => {
    const model = modelMap.get(apiCall.aiModelId)
    if (!model) return

    const modelName = model.name
    const current = modelStats.get(modelName) || {
      count: 0,
      tokens: 0,
      success: 0,
      lastUsed: new Date(0)
    }

    current.count++
    current.tokens += (apiCall.inputTokens || 0) + (apiCall.outputTokens || 0)
    if (apiCall.success) {
      current.success++
    }
    if (apiCall.timestamp > current.lastUsed) {
      current.lastUsed = apiCall.timestamp
    }

    modelStats.set(modelName, current)

    // Process user statistics
    if (apiCall.userId) {
      const user = userMap.get(apiCall.userId)
      if (user) {
        const userStat = userStatsMap.get(user.email) || {
          requestCount: 0,
          totalTokens: 0,
          lastUsed: new Date(0)
        }

        userStat.requestCount++
        userStat.totalTokens += (apiCall.inputTokens || 0) + (apiCall.outputTokens || 0)
        if (apiCall.timestamp > userStat.lastUsed) {
          userStat.lastUsed = apiCall.timestamp
        }

        userStatsMap.set(user.email, userStat)
      }
    }
  })

  // Update line chart data
  const hourlyData = new Map<number, number>()
  const hourlyUsers = new Map<number, Set<string>>()

  apiCalls.forEach(apiCall => {
    const hour = new Date(apiCall.timestamp).getHours()
    hourlyData.set(hour, (hourlyData.get(hour) || 0) + 1)

    // Track unique users per hour
    if (apiCall.userId) {
      const userSet = hourlyUsers.get(hour) || new Set<string>()
      userSet.add(apiCall.userId)
      hourlyUsers.set(hour, userSet)
    }
  })

  lineChartData.value = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        label: '请求数量',
        data: Array.from({ length: 24 }, (_, i) => hourlyData.get(i) || 0),
        borderColor: CHART_COLORS.primary,
        backgroundColor: CHART_COLORS.primaryBg,
        tension: 0.4
      }
    ]
  }

  // Update user activity data
  userActivityData.value = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        label: '活跃用户数',
        data: Array.from({ length: 24 }, (_, i) => hourlyUsers.get(i)?.size || 0),
        backgroundColor: CHART_COLORS.successFill,
        borderColor: CHART_COLORS.success,
        borderWidth: 1
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
        backgroundColor: DOUGHNUT_COLORS,
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

  // Update user stats with pagination
  const allUserStats = Array.from(userStatsMap.entries())
    .sort((a, b) => b[1].requestCount - a[1].requestCount)

  // Update pagination info
  userPagination.value.total = allUserStats.length

  // Get current page data
  const startIndex = userPagination.value.page * userPagination.value.pageSize
  const endIndex = startIndex + userPagination.value.pageSize
  const paginatedUserStats = allUserStats.slice(startIndex, endIndex)

  userStats.value = paginatedUserStats.map(([userEmail, stats]) => ({
    userEmail,
    requestCount: stats.requestCount,
    totalTokens: stats.totalTokens,
    lastUsed: stats.lastUsed.toLocaleString()
  }))
}

onMounted(() => {
  loadRequestStats()
})

defineExpose({
  loadRequestStats,
  changeUserPage
})
</script>

<style scoped>
.chart-container {
  height: 300px;
}
</style>