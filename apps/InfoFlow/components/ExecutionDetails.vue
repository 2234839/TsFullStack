<template>
  <div class="space-y-4">
    <!-- Basic Info -->
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">执行ID</label>
        <div class="text-sm text-gray-900 font-mono">{{ execution.id }}</div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">规则名称</label>
        <div class="text-sm text-gray-900">{{ execution.ruleName }}</div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">执行状态</label>
        <div>
          <span
            :class="[
              'text-xs px-2 py-1 rounded-md font-medium',
              execution.status === 'completed'
                ? 'bg-green-100 text-green-800'
                : execution.status === 'failed'
                ? 'bg-red-100 text-red-800'
                : execution.status === 'running'
                ? 'bg-blue-100 text-blue-800'
                : execution.status === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-800',
            ]">
            {{ getStatusText(execution.status) }}
          </span>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">执行类型</label>
        <div>
          <span
            :class="[
              'text-xs px-2 py-1 rounded-md',
              execution.executionType === 'manual'
                ? 'bg-purple-100 text-purple-800'
                : execution.executionType === 'scheduled'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-green-100 text-green-800',
            ]">
            {{ getExecutionTypeText(execution.executionType) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Time Info -->
    <div class="grid grid-cols-3 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
        <div class="text-sm text-gray-900">
          {{ execution.startTime ? formatDateTime(execution.startTime) : '-' }}
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
        <div class="text-sm text-gray-900">
          {{ execution.endTime ? formatDateTime(execution.endTime) : '-' }}
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">执行耗时</label>
        <div class="text-sm text-gray-900">
          {{ execution.duration ? formatDuration(execution.duration) : '-' }}
        </div>
      </div>
    </div>

    <!-- Trigger Info -->
    <div v-if="execution.triggerInfo">
      <label class="block text-sm font-medium text-gray-700 mb-1">触发信息</label>
      <div class="text-sm text-gray-900 bg-gray-100 p-2 rounded">
        {{ execution.triggerInfo }}
      </div>
    </div>

    <!-- Result Info -->
    <div v-if="execution.result">
      <label class="block text-sm font-medium text-gray-700 mb-1">执行结果</label>
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
        <div v-if="execution.result.title">
          <span class="text-sm font-medium">标题:</span>
          <span class="text-sm text-gray-900 ml-2">{{ execution.result.title }}</span>
        </div>
        <div v-if="execution.result.timestamp">
          <span class="text-sm font-medium">时间戳:</span>
          <span class="text-sm text-gray-900 ml-2">{{
            execution.result.timestamp
          }}</span>
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
          <span class="text-sm font-medium">收集数据:</span>
          
          <!-- Comparison Mode -->
          <div v-if="showComparison && previousExecution" class="mt-2">
            <div class="mb-2 p-2 bg-blue-50 rounded border border-blue-200">
              <div class="text-xs text-blue-800">
                <i class="pi pi-info-circle mr-1"></i>
                对比模式: 与上一次执行结果比较
              </div>
            </div>
            
            <div class="space-y-2">
              <div v-for="(collection, key) in execution.result.collections" :key="key" class="border border-gray-200 rounded p-2">
                <div class="flex items-center justify-between mb-1">
                  <div class="text-xs font-medium text-gray-700">{{ key }}</div>
                  <div class="text-xs text-gray-500">
                    执行时间: {{ formatDateTime(collection.timestamp) }} | 
                    耗时: {{ formatDuration(collection.executionTime) }}
                  </div>
                </div>
                
                <div class="space-y-1">
                  <div v-for="(item, index) in collection.items" :key="index" class="text-sm">
                    <div v-if="shouldShowItem(item.changeType)" class="flex items-start gap-2 p-1 rounded border"
                         :class="getChangeColorClass(item.changeType)">
                      <div class="flex items-center gap-1">
                        <i :class="['pi text-xs', getChangeIcon(item.changeType)]"></i>
                        <span class="text-xs px-1 py-0.5 rounded bg-white" 
                              :class="getTypeColorClass(item.type)">
                          {{ item.type }}
                        </span>
                      </div>
                      <div class="flex-1">
                        <div class="flex items-center gap-2 text-xs text-gray-600 mb-1">
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
                            <i class="pi pi-check"></i> 未变化
                          </span>
                        </div>
                        <div v-if="item.selector" class="text-xs text-gray-500">选择器: {{ item.selector }}</div>
                        <div v-if="item.attribute" class="text-xs text-gray-500">属性: {{ item.attribute }}</div>
                        <div class="text-gray-900">值: {{ item.value }}</div>
                        <div v-if="item.html" class="mt-1">
                          <div class="text-xs text-gray-500 mb-1">HTML内容:</div>
                          <div class="bg-white p-2 rounded text-sm border border-gray-200" v-html="item.html"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Original Display Mode -->
          <div v-else class="mt-2 space-y-2">
            <div v-for="(collection, key) in execution.result.collections" :key="key" class="border border-gray-200 rounded p-2">
              <div class="flex items-center justify-between mb-1">
                <div class="text-xs font-medium text-gray-700">{{ key }}</div>
                <div class="text-xs text-gray-500">
                  执行时间: {{ formatDateTime(collection.timestamp) }} | 
                  耗时: {{ formatDuration(collection.executionTime) }}
                </div>
              </div>
              <div class="space-y-1">
                <div v-for="(item, index) in collection.items" :key="index" class="text-sm">
                  <div class="flex items-start gap-2">
                    <span class="text-xs px-1 py-0.5 rounded" 
                          :class="getTypeColorClass(item.type)">
                      {{ item.type }}
                    </span>
                    <div class="flex-1">
                      <div v-if="item.selector" class="text-xs text-gray-500">选择器: {{ item.selector }}</div>
                      <div v-if="item.attribute" class="text-xs text-gray-500">属性: {{ item.attribute }}</div>
                      <div class="text-gray-900">值: {{ item.value }}</div>
                      <div v-if="item.html" class="mt-1">
                        <div class="text-xs text-gray-500 mb-1">HTML内容:</div>
                        <div class="bg-gray-50 p-2 rounded text-sm border border-gray-200" v-html="item.html"></div>
                      </div>
                    </div>
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
      <pre class="text-sm text-gray-900 bg-gray-100 p-3 rounded overflow-x-auto border border-gray-200">{{
        JSON.stringify(execution.metadata, null, 2)
      }}</pre>
    </div>
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
    showUnchanged: false,
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