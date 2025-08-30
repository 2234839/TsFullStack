<template>
  <div>
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
          icon="pi pi-circle-fill"
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
        <SelectButton
          v-model="readStatusFilter"
          :options="readStatusOptions"
          optionLabel="label"
          optionValue="value"
          :allowEmpty="false"
          class="text-sm" />
        <Button
          icon="pi pi-filter"
          @click="showComparisonFilter = !showComparisonFilter"
          :severity="showComparisonFilter ? 'primary' : 'secondary'"
          size="small"
          v-tooltip="'对比过滤选项'" />
      </div>
    </div>

    <!-- Comparison Filter Panel -->
    <div v-if="showComparisonFilter" class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-sm font-medium text-blue-900">对比过滤选项</h4>
        <Button
          icon="pi pi-times"
          @click="showComparisonFilter = false"
          size="small"
          text
          severity="secondary" />
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="flex items-center gap-2">
          <Checkbox
            v-model="config.comparisonFilter.showAdded"
            inputId="showAdded"
            :binary="true"
            size="small" />
          <label for="showAdded" class="text-sm text-blue-800 cursor-pointer">
            <span class="inline-block w-3 h-3 bg-green-500 rounded mr-1"></span>
            新增数据
          </label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox
            v-model="config.comparisonFilter.showRemoved"
            inputId="showRemoved"
            :binary="true"
            size="small" />
          <label for="showRemoved" class="text-sm text-blue-800 cursor-pointer">
            <span class="inline-block w-3 h-3 bg-red-500 rounded mr-1"></span>
            删除数据
          </label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox
            v-model="config.comparisonFilter.showMoved"
            inputId="showMoved"
            :binary="true"
            size="small" />
          <label for="showMoved" class="text-sm text-blue-800 cursor-pointer">
            <span class="inline-block w-3 h-3 bg-yellow-500 rounded mr-1"></span>
            位置移动
          </label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox
            v-model="config.comparisonFilter.showUnchanged"
            inputId="showUnchanged"
            :binary="true"
            size="small" />
          <label for="showUnchanged" class="text-sm text-blue-800 cursor-pointer">
            <span class="inline-block w-3 h-3 bg-gray-400 rounded mr-1"></span>
            未变化
          </label>
        </div>
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
        :rowStyle="getRowStyle"
        v-model:expandedRows="expandedRows"
        dataKey="id">
        <Column :expander="true" headerStyle="width: 3rem">
          <template #body="slotProps">
            <Button
              :icon="expandedRows[slotProps.data.id] ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
              @click="toggleExecutionDetails(slotProps.data)"
              size="small"
              text
              severity="secondary"
              class="w-8 h-8"
            />
          </template>
        </Column>
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

        <Column field="actions" header="操作" class="w-[120px]">
          <template #body="slotProps">
            <div class="flex gap-1">
              <Button
                :icon="slotProps.data.isRead ? 'pi pi-circle' : 'pi pi-circle-fill'"
                @click="toggleReadStatus(slotProps.data)"
                size="small"
                :severity="slotProps.data.isRead ? 'secondary' : ''"
                v-tooltip="slotProps.data.isRead ? '标记为未读' : '标记为已读'" />
              <Button
                :icon="expandedRows[slotProps.data.id] ? 'pi pi-eye-slash' : 'pi pi-eye'"
                @click="toggleExecutionDetails(slotProps.data)"
                size="small"
                severity="info"
                v-tooltip="expandedRows[slotProps.data.id] ? '隐藏详情' : '查看详情'" />
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

        <!-- Row Expansion Template -->
        <template #expansion="slotProps">
          <div class="bg-gray-50">
            <ExecutionDetails
              :execution="getExecutionWithChangesLocal(slotProps.data)"
              :show-comparison="!!getPreviousExecution(slotProps.data)"
              :previous-execution="getPreviousExecution(slotProps.data)"
              :comparison-filter="config.comparisonFilter" />
          </div>
        </template>

        <template #empty>
          <div class="text-center py-8 text-gray-500">
            {{ hasActiveFilters ? '没有符合条件的执行记录' : '暂无执行记录' }}
          </div>
        </template>
      </DataTable>
    </div>

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
  import { ref, computed, onMounted, watch } from 'vue';
  import { getTaskExecutionService } from '@/entrypoints/background/service/taskExecutionService';

  const taskExecutionService = getTaskExecutionService();
  import { format } from 'date-fns';
  import type { TaskExecutionRecord } from '@/entrypoints/background/service/taskExecutionService';
  import { useInfoFlowConfig } from '@/storage/config';
  import { getExecutionWithChanges } from '@/utils/changeDetection';

  // PrimeVue components
  import Button from 'primevue/button';
  import DataTable from 'primevue/datatable';
  import Column from 'primevue/column';
  import Dialog from 'primevue/dialog';
  import SelectButton from 'primevue/selectbutton';
  import Badge from 'primevue/badge';
  import Checkbox from 'primevue/checkbox';
  import ExecutionDetails from './ExecutionDetails.vue';

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
  const readStatusFilter = ref<'all' | 'read' | 'unread'>('unread');

  // Dialog state
  const showDeleteDialog = ref(false);
  const showCancelDialog = ref(false);
  const selectedExecution = ref<TaskExecutionRecord | null>(null);

  // Expanded rows state
  const expandedRows = ref<Record<string, boolean>>({});

  // Configuration
  const config = useInfoFlowConfig();

  // Comparison filter state
  const showComparisonFilter = ref(false);

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

  const readStatusOptions = [
    { label: '全部', value: 'all' },
    { label: '未读', value: 'unread' },
    { label: '已读', value: 'read' },
  ];

  // Computed
  const hasActiveFilters = computed(() => {
    return statusFilter.value || readStatusFilter.value !== 'all';
  });

  const unreadCount = computed(() => {
    return executions.value.filter((exec) => !(exec.isRead ?? 0)).length;
  });

  // Methods
  const loadExecutionRecords = async () => {
    loading.value = true;
    try {
      const result = await taskExecutionService.getPaginatedExecutionsByRuleId(props.ruleId, {
        page: currentPage.value,
        limit: pageSize.value,
        status: statusFilter.value || undefined,
        isRead:
          readStatusFilter.value === 'unread'
            ? 0
            : readStatusFilter.value === 'read'
            ? 1
            : undefined,
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

  const toggleExecutionDetails = async (execution: TaskExecutionRecord) => {
    const currentExpandedState = expandedRows.value[execution.id] || false;
    const shouldExpand = !currentExpandedState;

    // 如果是未读状态，自动标记为已读
    const isRead = execution.isRead ?? 0;
    if (!isRead) {
      try {
        await taskExecutionService.markAsRead(execution.id);

        // 如果当前筛选器是"未读"，自动切换到"全部"以便用户能看到刚标记为已读的消息
        if (readStatusFilter.value === 'unread') {
          readStatusFilter.value = 'all';
        }

        // 重新加载数据以更新已读状态
        await loadExecutionRecords();
        // 通知父组件读取状态已变更
        emit('readStatusChanged', props.ruleId);
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }

    // 切换展开状态 - 使用 v-model:expandedRows 的方式
    expandedRows.value = {
      ...expandedRows.value,
      [execution.id]: shouldExpand,
    };
    if (!shouldExpand) {
      delete expandedRows.value[execution.id];
    }
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
      toggleExecutionDetails(event.data);
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

  const formatDuration = (duration: number) => {
    if (duration < 1000) {
      return `${duration}ms`;
    } else if (duration < 60000) {
      return `${(duration / 1000).toFixed(1)}s`;
    } else {
      return `${(duration / 60000).toFixed(1)}min`;
    }
  };

  // 获取前一次执行记录
  const getPreviousExecution = (
    currentExecution: TaskExecutionRecord,
  ): TaskExecutionRecord | null => {
    if (!currentExecution.startTime) return null;

    const currentTime = new Date(currentExecution.startTime).getTime();

    // 找到所有在当前执行时间之前的已完成执行记录
    const previousExecutions = executions.value.filter(exec =>
      exec.id !== currentExecution.id &&
      exec.status === 'completed' &&
      exec.result?.collections &&
      exec.startTime &&
      new Date(exec.startTime).getTime() < currentTime
    );

    if (previousExecutions.length === 0) return null;

    // 按执行时间降序排序，取最近的一次
    previousExecutions.sort((a, b) =>
      new Date(b.startTime!).getTime() - new Date(a.startTime!).getTime()
    );

    return previousExecutions[0];
  };

  // 为执行结果添加变化信息
  const getExecutionWithChangesLocal = (execution: TaskExecutionRecord): TaskExecutionRecord => {
    const previousExecution = getPreviousExecution(execution);
    const executionWithChanges = getExecutionWithChanges(execution, previousExecution);
    
    // 返回完整的 TaskExecutionRecord 对象，但替换 result 为带变化信息的版本
    return {
      ...execution,
      result: executionWithChanges,
    };
  };

  // Lifecycle
  onMounted(async () => {
    // Dexie 自动处理，不需要迁移
    loadExecutionRecords();
  });

  // Watch for filter changes
  watch([statusFilter, readStatusFilter], () => {
    currentPage.value = 1;
    // 注意：这里调用 loadExecutionRecords 会保持当前页面记录的展开状态
    // 但切换筛选器后，某些记录可能不再显示，这是预期行为
    loadExecutionRecords();
  });
</script>

<style scoped>
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
