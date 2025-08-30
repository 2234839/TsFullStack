<template>
  <!-- Result Info -->
  <div v-if="execution.result">
    <div class="bg-white p-3 rounded space-y-2 border border-gray-200">
      <div v-if="execution.result.url">
        <span class="text-sm font-medium">URL:</span>
        <a
          :href="execution.result.url"
          target="_blank"
          class="text-sm text-blue-600 hover:underline ml-2">
          {{ execution.result.url }}
        </a>
      </div>
      <div v-if="execution.result.message">
        <span class="text-sm font-medium">消息:</span>
        <span class="text-sm text-gray-900 ml-2">{{ execution.result.message }}</span>
      </div>
      <div v-if="execution.result.data">
        <span class="text-sm font-medium">数据:</span>
        <pre class="text-sm text-gray-900 bg-gray-50 p-2 rounded mt-1 overflow-x-auto">{{
          JSON.stringify(execution.result.data, null, 2)
        }}</pre>
      </div>

      <!-- Collections with Comparison -->
      <div v-if="execution.result.collections">
        <div class="space-y-2">
          <div
            v-for="(collection, key) in execution.result.collections"
            :key="key"
            class="border border-gray-200 rounded p-2">
            <div class="flex items-center justify-between mb-1">
              <div class="text-xs text-gray-500">
                执行时间: {{ formatDateTime(collection.timestamp) }} | 耗时:
                {{ formatDuration(collection.executionTime) }}
              </div>
            </div>

            <div class="space-y-1">
              <div v-for="(item, index) in collection.items" :key="index" class="text-sm">
                <div class="flex items-center gap-2 text-xs text-gray-600 mb-1">
                  <span
                    :class="[
                      'inline-flex items-center justify-center w-6! h-6 rounded-full text-xs font-medium',
                      item.changeType === 'added' ? 'bg-green-100 text-green-700' :
                      item.changeType === 'removed' ? 'bg-red-100 text-red-700' :
                      item.changeType === 'moved' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    ]">
                    {{ index + 1 }}
                  </span>
                  <span v-if="item.changeType === 'added'" class="text-green-700">
                    <i class="pi pi-plus"></i> 新增
                  </span>
                  <span v-else-if="item.changeType === 'removed'" class="text-red-700">
                    <i class="pi pi-minus"></i> 删除
                  </span>
                  <span v-else-if="item.changeType === 'moved'" class="text-yellow-700">
                    <i class="pi pi-arrows-alt"></i>
                    位置 {{ item.previousIndex + 1 }} → {{ item.currentIndex + 1 }}
                  </span>
                  <span v-else-if="item.changeType === 'unchanged'" class="text-gray-600">
                    <i class="pi pi-check"></i> 无变化
                  </span>
                  <span v-else class="text-gray-600"> <i class="pi pi-circle"></i> 无变化 </span>
                  <div v-if="item.selector" class="text-xs text-gray-500">
                    选择器: {{ item.selector }}
                  </div>
                  <div v-if="item.attribute" class="text-xs text-gray-500">
                    属性: {{ item.attribute }}
                  </div>
                </div>
                <!--    :class="getChangeColorClass(item.changeType)" -->
                <div
                  v-if="shouldShowItem(item.changeType)"
                  class="flex items-start gap-2 p-1 rounded border-t border-sky-200">
                  <div v-if="item.html" v-html="item.html" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Error Info -->
  <div v-if="execution.error">
    <label class="block text-sm font-medium text-gray-700 mb-1">错误信息</label>
    <div class="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
      {{ execution.error }}
    </div>
  </div>

  <!-- Metadata -->
  <div v-if="execution.metadata">
    <label class="block text-sm font-medium text-gray-700 mb-1">元数据</label>
    <pre
      class="text-sm text-gray-900 bg-gray-100 p-3 rounded overflow-x-auto border border-gray-200"
      >{{ JSON.stringify(execution.metadata, null, 2) }}</pre
    >
  </div>
</template>

<script setup lang="ts">
  import { format } from 'date-fns';
  import type { TaskExecutionRecord } from '@/entrypoints/background/service/taskExecutionService';

  interface Props {
    execution: TaskExecutionRecord;
    showComparison?: boolean;
    previousExecution?: TaskExecutionRecord | null;
    comparisonFilter?: {
      showAdded: boolean;
      showRemoved: boolean;
      showMoved: boolean;
      showUnchanged: boolean;
    };
  }

  const props = withDefaults(defineProps<Props>(), {
    showComparison: false,
    previousExecution: null,
    comparisonFilter: () => ({
      showAdded: true,
      showRemoved: true,
      showMoved: true,
      showUnchanged: true,
    }),
  });

  // Status options
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

  // Methods
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

  const getTypeColorClass = (type: string) => {
    switch (type) {
      case 'text':
        return 'bg-blue-100 text-blue-800';
      case 'html':
        return 'bg-green-100 text-green-800';
      case 'attribute':
        return 'bg-purple-100 text-purple-800';
      case 'js':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const shouldShowItem = (changeType?: string) => {
    if (!changeType) return true;

    switch (changeType) {
      case 'added':
        return props.comparisonFilter.showAdded;
      case 'removed':
        return props.comparisonFilter.showRemoved;
      case 'moved':
        return props.comparisonFilter.showMoved;
      case 'unchanged':
        return props.comparisonFilter.showUnchanged;
      default:
        return true;
    }
  };

  const getChangeColorClass = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'removed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'moved':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'unchanged':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return 'pi pi-plus';
      case 'removed':
        return 'pi pi-minus';
      case 'moved':
        return 'pi pi-arrows-alt';
      case 'unchanged':
        return 'pi pi-check';
      default:
        return 'pi pi-circle';
    }
  };
</script>
