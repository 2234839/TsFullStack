<template>
  <div class="execution-records">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <h3 class="text-lg font-medium text-gray-800">执行记录</h3>
        <Badge :value="totalRecords" severity="info" size="small" />
        <Badge v-if="unreadCount > 0" :value="unreadCount" severity="warning" size="small" />
      </div>
      <div class="flex gap-2">
        <Button
          v-if="unreadCount > 0"
          icon="pi pi-envelope-open"
          @click="markAllAsRead"
          :loading="loading"
          severity="secondary"
          size="small"
          v-tooltip="'全部标记为已读'" />
        <Button
          icon="pi pi-refresh"
          @click="loadExecutionRecords"
          :loading="loading"
          severity="secondary"
          size="small" />
        <Button
          icon="pi pi-filter"
          @click="showFilterDialog = true"
          severity="secondary"
          size="small"
          v-tooltip="'筛选'" />
      </div>
    </div>

    <!-- Filter Summary -->
    <div v-if="hasActiveFilters" class="mb-4 p-3 bg-blue-50 rounded-lg">
      <div class="flex items-center justify-between">
        <div class="flex flex-wrap gap-2">
          <Chip
            v-if="statusFilter"
            :label="`状态: ${getStatusText(statusFilter)}`"
            removable
            @remove="statusFilter = ''"
            size="small" />
          <Chip
            v-if="executionTypeFilter"
            :label="`类型: ${getExecutionTypeText(executionTypeFilter)}`"
            removable
            @remove="executionTypeFilter = ''"
            size="small" />
          <Chip
            v-if="dateRange.start && dateRange.end"
            :label="`日期: ${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`"
            removable
            @remove="clearDateRange"
            size="small" />
        </div>
        <Button label="清除筛选" @click="clearFilters" severity="secondary" size="small" text />
      </div>
    </div>

    <!-- Execution Records Table -->
    <div class="bg-white rounded-lg">
      <DataTable
        :value="executions"
        :loading="loading"
        :paginator="true"
        :rows="pageSize"
        :totalRecords="totalRecords"
        :rowsPerPageOptions="[5, 10, 20]"
        :lazy="true"
        @page="handlePageChange"
        @row-click="onRowClick"
        responsiveLayout="scroll"
        size="small"
        :rowStyle="getRowStyle">
        <Column field="status" header="状态" class="w-[120px]">
          <template #body="slotProps">
            <div class="flex items-center gap-2">
              <div
                :class="[
                  'w-2 h-2 rounded-full',
                  slotProps.data.isRead ?? 0 ? 'bg-gray-400' : 'bg-blue-500',
                ]"
                :title="slotProps.data.isRead ?? 0 ? '已读' : '未读'"></div>
              <span
                :class="[
                  'text-xs px-2 py-1 rounded-md font-medium',
                  slotProps.data.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : slotProps.data.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : slotProps.data.status === 'running'
                    ? 'bg-blue-100 text-blue-800'
                    : slotProps.data.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800',
                ]">
                {{ getStatusText(slotProps.data.status) }}
              </span>
            </div>
          </template>
        </Column>

        <Column field="executionType" header="类型" class="w-[80px]">
          <template #body="slotProps">
            <span
              :class="[
                'text-xs px-2 py-1 rounded-md',
                slotProps.data.executionType === 'manual'
                  ? 'bg-purple-100 text-purple-800'
                  : slotProps.data.executionType === 'scheduled'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-green-100 text-green-800',
              ]">
              {{ getExecutionTypeText(slotProps.data.executionType) }}
            </span>
          </template>
        </Column>

        <Column field="createdAt" header="执行时间" class="w-[180px]">
          <template #body="slotProps">
            <div class="text-sm">
              <div>{{ formatDateTime(slotProps.data.createdAt) }}</div>
              <div v-if="slotProps.data.duration !== undefined" class="text-xs text-gray-500">
                耗时: {{ formatDuration(slotProps.data.duration) }}
              </div>
            </div>
          </template>
        </Column>

        <Column field="matched" header="匹配结果" class="w-[100px]">
          <template #body="slotProps">
            <div class="text-center">
              <span
                :class="[
                  'text-xs px-2 py-1 rounded-md font-medium',
                  slotProps.data.matched
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800',
                ]">
                {{ slotProps.data.matched ? '匹配' : '未匹配' }}
              </span>
              <div
                v-if="slotProps.data.matchedCount !== undefined"
                class="text-xs text-gray-500 mt-1">
                {{ slotProps.data.matchedCount }} 项
              </div>
            </div>
          </template>
        </Column>

        <Column field="result" header="结果摘要" class="min-w-[200px]">
          <template #body="slotProps">
            <div class="text-sm">
              <div v-if="slotProps.data.status === 'completed' && slotProps.data.result">
                <div class="font-medium">{{ slotProps.data.result.title || '无标题' }}</div>
                <div class="text-xs text-gray-500 truncate">{{ slotProps.data.result.url }}</div>
                <div v-if="slotProps.data.result.message" class="text-xs text-blue-600 mt-1">
                  {{ slotProps.data.result.message }}
                </div>
              </div>
              <div v-else-if="slotProps.data.status === 'failed'" class="text-red-600 text-xs">
                {{ slotProps.data.error || '执行失败' }}
              </div>
              <div v-else-if="slotProps.data.status === 'running'" class="text-blue-600 text-xs">
                执行中...
              </div>
              <div v-else class="text-gray-500 text-xs">等待执行</div>
            </div>
          </template>
        </Column>

        <Column field="actions" header="操作" class="w-[150px]">
          <template #body="slotProps">
            <div class="flex gap-1">
              <Button
                :icon="slotProps.data.isRead ? 'pi pi-envelope-open' : 'pi pi-envelope'"
                @click="toggleReadStatus(slotProps.data)"
                size="small"
                :severity="slotProps.data.isRead ? 'secondary' : 'info'"
                v-tooltip="slotProps.data.isRead ? '标记为未读' : '标记为已读'" />
              <Button
                icon="pi pi-eye"
                @click="viewExecutionDetails(slotProps.data)"
                size="small"
                severity="info"
                v-tooltip="'查看详情'" />
              <Button
                v-if="slotProps.data.status === 'running'"
                icon="pi pi-times"
                @click="confirmCancelExecution(slotProps.data)"
                size="small"
                severity="warning"
                v-tooltip="'取消执行'" />
              <Button
                icon="pi pi-trash"
                @click="confirmDeleteExecution(slotProps.data)"
                size="small"
                severity="danger"
                v-tooltip="'删除记录'" />
            </div>
          </template>
        </Column>

        <template #empty>
          <div class="text-center py-8 text-gray-500">
            {{ hasActiveFilters ? '没有符合条件的执行记录' : '暂无执行记录' }}
          </div>
        </template>
      </DataTable>
    </div>

    <!-- Filter Dialog -->
    <Dialog v-model:visible="showFilterDialog" header="筛选执行记录" modal class="max-w-[500px]">
      <div class="flex flex-col gap-4">
        <div>
          <label class="block text-sm font-medium mb-2">执行状态</label>
          <Select
            v-model="statusFilter"
            :options="statusOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="选择状态"
            class="w-full" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">执行类型</label>
          <Select
            v-model="executionTypeFilter"
            :options="executionTypeOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="选择类型"
            class="w-full" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">日期范围</label>
          <div class="grid grid-cols-2 gap-2">
            <Calendar
              :model-value="dateRange.start"
              @update:model-value="(value: Date | null) => dateRange.start = value"
              placeholder="开始日期"
              dateFormat="yy-mm-dd"
              :showIcon="true"
              class="w-full" />
            <Calendar
              :model-value="dateRange.end"
              @update:model-value="(value: Date | null) => dateRange.end = value"
              placeholder="结束日期"
              dateFormat="yy-mm-dd"
              :showIcon="true"
              class="w-full" />
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="取消" @click="showFilterDialog = false" severity="secondary" />
        <Button label="应用筛选" @click="applyFilters" />
      </template>
    </Dialog>

    <!-- Execution Details Dialog -->
    <Dialog v-model:visible="showDetailsDialog" header="执行详情" modal class="max-w-[800px]">
      <div v-if="selectedExecution" class="space-y-4">
        <!-- Basic Info -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">执行ID</label>
            <div class="text-sm text-gray-900 font-mono">{{ selectedExecution.id }}</div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">规则名称</label>
            <div class="text-sm text-gray-900">{{ selectedExecution.ruleName }}</div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">执行状态</label>
            <div>
              <span
                :class="[
                  'text-xs px-2 py-1 rounded-md font-medium',
                  selectedExecution.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : selectedExecution.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : selectedExecution.status === 'running'
                    ? 'bg-blue-100 text-blue-800'
                    : selectedExecution.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800',
                ]">
                {{ getStatusText(selectedExecution.status) }}
              </span>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">执行类型</label>
            <div>
              <span
                :class="[
                  'text-xs px-2 py-1 rounded-md',
                  selectedExecution.executionType === 'manual'
                    ? 'bg-purple-100 text-purple-800'
                    : selectedExecution.executionType === 'scheduled'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-green-100 text-green-800',
                ]">
                {{ getExecutionTypeText(selectedExecution.executionType) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Time Info -->
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
            <div class="text-sm text-gray-900">
              {{ selectedExecution.startTime ? formatDateTime(selectedExecution.startTime) : '-' }}
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
            <div class="text-sm text-gray-900">
              {{ selectedExecution.endTime ? formatDateTime(selectedExecution.endTime) : '-' }}
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">执行耗时</label>
            <div class="text-sm text-gray-900">
              {{ selectedExecution.duration ? formatDuration(selectedExecution.duration) : '-' }}
            </div>
          </div>
        </div>

        <!-- Trigger Info -->
        <div v-if="selectedExecution.triggerInfo">
          <label class="block text-sm font-medium text-gray-700 mb-1">触发信息</label>
          <div class="text-sm text-gray-900 bg-gray-50 p-2 rounded">
            {{ selectedExecution.triggerInfo }}
          </div>
        </div>

        <!-- Result Info -->
        <div v-if="selectedExecution.result">
          <label class="block text-sm font-medium text-gray-700 mb-1">执行结果</label>
          <div class="bg-gray-50 p-3 rounded space-y-2">
            <div v-if="selectedExecution.result.url">
              <span class="text-sm font-medium">URL:</span>
              <a
                :href="selectedExecution.result.url"
                target="_blank"
                class="text-sm text-blue-600 hover:underline ml-2">
                {{ selectedExecution.result.url }}
              </a>
            </div>
            <div v-if="selectedExecution.result.title">
              <span class="text-sm font-medium">标题:</span>
              <span class="text-sm text-gray-900 ml-2">{{ selectedExecution.result.title }}</span>
            </div>
            <div v-if="selectedExecution.result.timestamp">
              <span class="text-sm font-medium">时间戳:</span>
              <span class="text-sm text-gray-900 ml-2">{{
                selectedExecution.result.timestamp
              }}</span>
            </div>
            <div v-if="selectedExecution.result.message">
              <span class="text-sm font-medium">消息:</span>
              <span class="text-sm text-gray-900 ml-2">{{ selectedExecution.result.message }}</span>
            </div>
            <div v-if="selectedExecution.result.data">
              <span class="text-sm font-medium">数据:</span>
              <pre class="text-sm text-gray-900 bg-white p-2 rounded mt-1 overflow-x-auto">{{
                JSON.stringify(selectedExecution.result.data, null, 2)
              }}</pre>
            </div>
            <div v-if="selectedExecution.result.collections">
              <span class="text-sm font-medium">收集数据:</span>
              <pre class="text-sm text-gray-900 bg-white p-2 rounded mt-1 overflow-x-auto">{{
                JSON.stringify(selectedExecution.result.collections, null, 2)
              }}</pre>
            </div>
          </div>
        </div>

        <!-- Error Info -->
        <div v-if="selectedExecution.error">
          <label class="block text-sm font-medium text-gray-700 mb-1">错误信息</label>
          <div class="text-sm text-red-600 bg-red-50 p-3 rounded">
            {{ selectedExecution.error }}
          </div>
        </div>

        <!-- Metadata -->
        <div v-if="selectedExecution.metadata">
          <label class="block text-sm font-medium text-gray-700 mb-1">元数据</label>
          <pre class="text-sm text-gray-900 bg-gray-50 p-3 rounded overflow-x-auto">{{
            JSON.stringify(selectedExecution.metadata, null, 2)
          }}</pre>
        </div>
      </div>

      <template #footer>
        <Button label="关闭" @click="showDetailsDialog = false" severity="secondary" />
      </template>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:visible="showDeleteDialog" header="确认删除" modal class="max-w-[400px]">
      <p>确定要删除这条执行记录吗？此操作无法撤销。</p>

      <template #footer>
        <Button label="取消" @click="showDeleteDialog = false" severity="secondary" />
        <Button label="删除" @click="deleteExecution" :loading="deleting" severity="danger" />
      </template>
    </Dialog>

    <!-- Cancel Execution Dialog -->
    <Dialog v-model:visible="showCancelDialog" header="确认取消" modal class="max-w-[400px]">
      <p>确定要取消这次执行吗？</p>

      <template #footer>
        <Button label="取消" @click="showCancelDialog = false" severity="secondary" />
        <Button
          label="确认取消"
          @click="cancelExecution"
          :loading="cancelling"
          severity="warning" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, watch } from 'vue';
  import { getTaskExecutionService } from '@/entrypoints/background/service/taskExecutionService';

const taskExecutionService = getTaskExecutionService();
  import { format } from 'date-fns';
  import type { TaskExecutionRecord } from '@/entrypoints/background/service/taskExecutionService';

  // PrimeVue components
  import Button from 'primevue/button';
  import DataTable from 'primevue/datatable';
  import Column from 'primevue/column';
  import Dialog from 'primevue/dialog';
  import Select from 'primevue/select';
  import Calendar from 'primevue/calendar';
  import Badge from 'primevue/badge';
  import Chip from 'primevue/chip';

  interface Props {
    ruleId: string;
  }

  const props = defineProps<Props>();

  // Define emits
  const emit = defineEmits<{
    readStatusChanged: [ruleId: string];
    allMarkedAsRead: [ruleId: string];
  }>();

  // State
  const executions = ref<TaskExecutionRecord[]>([]);
  const loading = ref(false);
  const deleting = ref(false);
  const cancelling = ref(false);
  const currentPage = ref(1);
  const pageSize = ref(10);
  const totalRecords = ref(0);

  // Filter state
  const statusFilter = ref<TaskExecutionRecord['status'] | ''>('');
  const executionTypeFilter = ref<TaskExecutionRecord['executionType'] | ''>('');
  const dateRange = reactive({
    start: null as Date | null,
    end: null as Date | null,
  });
  const showFilterDialog = ref(false);

  // Dialog state
  const showDetailsDialog = ref(false);
  const showDeleteDialog = ref(false);
  const showCancelDialog = ref(false);
  const selectedExecution = ref<TaskExecutionRecord | null>(null);

  // Options
  const statusOptions = [
    { label: '已完成', value: 'completed' },
    { label: '失败', value: 'failed' },
    { label: '运行中', value: 'running' },
    { label: '等待中', value: 'pending' },
    { label: '已取消', value: 'cancelled' },
  ];

  const executionTypeOptions = [
    { label: '手动执行', value: 'manual' },
    { label: '定时执行', value: 'scheduled' },
    { label: '触发执行', value: 'triggered' },
  ];

  // Computed
  const hasActiveFilters = computed(() => {
    return statusFilter.value || executionTypeFilter.value || dateRange.start || dateRange.end;
  });

  const unreadCount = computed(() => {
    return executions.value.filter((exec) => !(exec.isRead ?? 0)).length;
  });

  // Methods
  const loadExecutionRecords = async () => {
    loading.value = true;
    try {
      const result = await taskExecutionService.getByRuleId(props.ruleId, {
        page: currentPage.value,
        limit: pageSize.value,
        status: statusFilter.value || undefined,
        executionType: executionTypeFilter.value || undefined,
        startDate: dateRange.start || undefined,
        endDate: dateRange.end || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      executions.value = result.executions;
      totalRecords.value = result.total;
    } catch (error) {
      console.error('Failed to load execution records:', error);
    } finally {
      loading.value = false;
    }
  };

  const handlePageChange = (event: any) => {
    currentPage.value = event.page + 1;
    pageSize.value = event.rows;
    loadExecutionRecords();
  };

  const applyFilters = () => {
    currentPage.value = 1;
    loadExecutionRecords();
    showFilterDialog.value = false;
  };

  const clearFilters = () => {
    statusFilter.value = '';
    executionTypeFilter.value = '';
    dateRange.start = null;
    dateRange.end = null;
    currentPage.value = 1;
    loadExecutionRecords();
  };

  const clearDateRange = () => {
    dateRange.start = null;
    dateRange.end = null;
    currentPage.value = 1;
    loadExecutionRecords();
  };

  const viewExecutionDetails = async (execution: TaskExecutionRecord) => {
    // 如果是未读状态，自动标记为已读
    const isRead = execution.isRead ?? 0;
    if (!isRead) {
      try {
        await taskExecutionService.markAsRead(execution.id);
        loadExecutionRecords();
        
        // 通知父组件读取状态已变更
        emit('readStatusChanged', props.ruleId);
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }
    selectedExecution.value = execution;
    showDetailsDialog.value = true;
  };

  const confirmDeleteExecution = (execution: TaskExecutionRecord) => {
    selectedExecution.value = execution;
    showDeleteDialog.value = true;
  };

  const deleteExecution = async () => {
    if (!selectedExecution.value) return;

    deleting.value = true;
    try {
      await taskExecutionService.delete(selectedExecution.value.id);
      showDeleteDialog.value = false;
      selectedExecution.value = null;
      loadExecutionRecords();
    } catch (error) {
      console.error('Failed to delete execution:', error);
    } finally {
      deleting.value = false;
    }
  };

  const confirmCancelExecution = (execution: TaskExecutionRecord) => {
    selectedExecution.value = execution;
    showCancelDialog.value = true;
  };

  const cancelExecution = async () => {
    if (!selectedExecution.value) return;

    cancelling.value = true;
    try {
      await taskExecutionService.cancelExecution(selectedExecution.value.id);
      showCancelDialog.value = false;
      selectedExecution.value = null;
      loadExecutionRecords();
    } catch (error) {
      console.error('Failed to cancel execution:', error);
    } finally {
      cancelling.value = false;
    }
  };

  const toggleReadStatus = async (execution: TaskExecutionRecord) => {
    try {
      const currentIsRead = execution.isRead ?? 0; // 如果 undefined，默认为 0（未读）

      if (currentIsRead === 1) {
        await taskExecutionService.markAsUnread(execution.id);
      } else {
        await taskExecutionService.markAsRead(execution.id);
      }

      // 立即更新本地状态以提供即时反馈
      const newIsRead: 0 | 1 = currentIsRead === 1 ? 0 : 1;
      const updatedExecution = { ...execution, isRead: newIsRead };
      const index = executions.value.findIndex((e) => e.id === execution.id);
      if (index !== -1) {
        executions.value[index] = updatedExecution;
      }

      // 从服务器重新加载以确认状态
      await loadExecutionRecords();
      
      // 通知父组件读取状态已变更
      emit('readStatusChanged', props.ruleId);
    } catch (error) {
      console.error('Failed to toggle read status:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await taskExecutionService.markAllAsRead(props.ruleId);
      loadExecutionRecords();
      
      // 通知父组件所有记录已标记为已读
      emit('allMarkedAsRead', props.ruleId);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const onRowClick = (event: any) => {
    if (
      event.data &&
      event.originalEvent.target.tagName !== 'BUTTON' &&
      event.originalEvent.target.tagName !== 'I'
    ) {
      viewExecutionDetails(event.data);
    }
  };

  const getRowStyle = (data: TaskExecutionRecord) => {
    const isRead = data.isRead ?? 0; // 如果 undefined，默认为 0（未读）
    if (isRead) {
      return {
        backgroundColor: '#f8fafc',
        cursor: 'pointer',
      };
    } else {
      return {
        backgroundColor: '#ffffff',
        borderLeft: '3px solid #3b82f6',
        fontWeight: '500',
        cursor: 'pointer',
      };
    }
  };

  const getStatusText = (status: string) => {
    const option = statusOptions.find((opt) => opt.value === status);
    return option?.label || status;
  };

  const getExecutionTypeText = (type: string) => {
    const option = executionTypeOptions.find((opt) => opt.value === type);
    return option?.label || type;
  };

  const formatDateTime = (date: Date | string) => {
    return format(new Date(date), 'yyyy-MM-dd HH:mm:ss');
  };

  const formatDate = (date: Date | string) => {
    return format(new Date(date), 'yyyy-MM-dd');
  };

  const formatDuration = (duration: number) => {
    if (duration < 1000) {
      return `${duration}ms`;
    } else if (duration < 60000) {
      return `${(duration / 1000).toFixed(1)}s`;
    } else {
      return `${(duration / 60000).toFixed(1)}min`;
    }
  };

  // Lifecycle
  onMounted(async () => {
    // Dexie 自动处理，不需要迁移
    loadExecutionRecords();
  });

  // Watch for filter changes
  watch([statusFilter, executionTypeFilter, dateRange], () => {
    if (!showFilterDialog.value) {
      currentPage.value = 1;
      loadExecutionRecords();
    }
  });
</script>

<style scoped>
  .execution-records {
    padding: 1rem;
    background: #f8fafc;
    border-radius: 0.5rem;
  }

  :deep(.p-datatable-wrapper) {
    border-radius: 0.375rem;
  }

  :deep(.p-datatable .p-datatable-tbody > tr) {
    cursor: pointer;
  }

  :deep(.p-datatable .p-datatable-tbody > tr:hover) {
    background-color: #f1f5f9 !important;
  }
</style>
