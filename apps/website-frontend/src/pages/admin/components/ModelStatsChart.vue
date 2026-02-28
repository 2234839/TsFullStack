<!-- ABOUTME: Model statistics chart component showing AI model usage trends and distribution -->
<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        {{ t('请求趋势') }}
      </h3>
      <Chart type="line" :data="lineChartData" :options="chartOptions" />
    </div>

    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        {{ t('用户活跃度') }}
      </h3>
      <Chart type="bar" :data="userActivityData" :options="barOptions" />
    </div>

    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        {{ t('模型分布') }}
      </h3>
      <Chart type="doughnut" :data="doughnutChartData" :options="doughnutOptions" />
    </div>

    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        {{ t('用户排行') }}
      </h3>
      <DataTable :value="userStats" stripedRows responsiveLayout="scroll">
        <Column field="userEmail" :header="t('用户邮箱')"></Column>
        <Column field="requestCount" :header="t('请求数量')"></Column>
        <Column field="totalTokens" :header="t('总令牌数')"></Column>
        <Column field="lastUsed" :header="t('最后使用时间')"></Column>
      </DataTable>

      <!-- Pagination controls -->
      <div class="flex justify-between items-center mt-4">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('显示') }} {{ (userPagination.page - 1) * userPagination.pageSize + 1 }} -
          {{ Math.min(userPagination.page * userPagination.pageSize, userPagination.total) }}
          {{ t('共') }} {{ userPagination.total }} {{ t('条记录') }}
        </div>
        <div class="flex space-x-2">
          <Button
            :disabled="userPagination.page === 1"
            @click="changeUserPage(userPagination.page - 1)"
            class="p-2"
          >
            {{ t('上一页') }}
          </Button>
          <Button
            :disabled="userPagination.page === userPagination.totalPages"
            @click="changeUserPage(userPagination.page + 1)"
            class="p-2"
          >
            {{ t('下一页') }}
          </Button>
        </div>
      </div>
    </div>

    <div class="lg:col-span-2 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        {{ t('详细统计') }}
      </h3>
      <DataTable :value="detailedStats" stripedRows responsiveLayout="scroll">
        <Column field="modelName" :header="t('模型名称')"></Column>
        <Column field="requestCount" :header="t('请求数量')"></Column>
        <Column field="successRate" :header="t('成功率')">
          <template #body="slotProps">
            {{ slotProps.data.successRate }}%
          </template>
        </Column>
        <Column field="avgTokens" :header="t('平均令牌数')"></Column>
        <Column field="lastUsed" :header="t('最后使用时间')"></Column>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Chart, DataTable, Column, Button } from '@/components/base'
import { useAPI } from '@/api'
import { useI18n } from '@/composables/useI18n'

const { API } = useAPI()
const { t } = useI18n()

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
const userStats = ref<UserStat[]>([])
const userActivityData = ref({
  labels: [] as string[],
  datasets: [
    {
      label: '活跃用户数',
      data: [] as number[],
      backgroundColor: 'rgba(16, 185, 129, 0.8)',
      borderColor: 'rgb(16, 185, 129)',
      borderWidth: 1
    }
  ]
})

const userPagination = ref({
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0
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
  const startTime = new Date(now.getTime() - 24 * 24 * 60 * 60 * 1000)

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
  const userIds = Array.from(uniqueUserIds)
  const userMap = new Map<string, { id: string; email: string }>()

  if (userIds.length > 0) {
    // Batch fetch users in chunks to avoid large queries
    const chunkSize = 100
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize)
      const users = await API.db.user.findMany({
        where: {
          id: {
            in: chunk
          }
        },
        select: {
          id: true,
          email: true
        }
      }) as { id: string; email: string }[]

      users.forEach(user => {
        userMap.set(user.id, user)
      })
    }
  }

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
  userPagination.value.totalPages = Math.ceil(allUserStats.length / userPagination.value.pageSize)

  // Get current page data
  const startIndex = (userPagination.value.page - 1) * userPagination.value.pageSize
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
  const startTime = new Date(now.getTime() - (timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000)

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
  const userIds = Array.from(uniqueUserIds)
  const userMap = new Map<string, { id: string; email: string }>()

  if (userIds.length > 0) {
    // Batch fetch users in chunks to avoid large queries
    const chunkSize = 100
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize)
      const users = await API.db.user.findMany({
        where: {
          id: {
            in: chunk
          }
        },
        select: {
          id: true,
          email: true
        }
      }) as { id: string; email: string }[]

      users.forEach(user => {
        userMap.set(user.id, user)
      })
    }
  }

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
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
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
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgb(16, 185, 129)',
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

  // Update user stats with pagination
  const allUserStats = Array.from(userStatsMap.entries())
    .sort((a, b) => b[1].requestCount - a[1].requestCount)

  // Update pagination info
  userPagination.value.total = allUserStats.length
  userPagination.value.totalPages = Math.ceil(allUserStats.length / userPagination.value.pageSize)

  // Get current page data
  const startIndex = (userPagination.value.page - 1) * userPagination.value.pageSize
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