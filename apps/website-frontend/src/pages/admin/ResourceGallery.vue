<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAPI } from '@/api';
import { Dialog, Select } from '@tsfullstack/shared-frontend/components';
import type { SelectOption } from '@tsfullstack/shared-frontend/components';

const toast = useToast();
const { API } = useAPI();

/** 资源项类型（简化版，符合API返回） */
interface ResourceItem {
  id: number;
  type: 'IMAGE' | 'TEXT' | 'VIDEO' | 'AUDIO' | 'FILE';
  title: string;
  description?: string | null;
  status: string;
  created: string | Date;
  metadata?: unknown;
  file?: {
    id: number;
  } | null;
}

/** 资源列表 */
const resources = ref<ResourceItem[]>([]);

/** 任务列表 */
// const tasks = ref<TaskItem[]>([]);

/** 总数 */
const total = ref(0);

/** 加载中 */
const isLoading = ref(false);

/** 当前页 */
const currentPage = ref(0);

/** 每页数量 */
const pageSize = 20;

/** 状态筛选 */
const statusFilter = ref<string>('all');

/** 资源类型筛选 */
const typeFilter = ref<string>('all');

/** 状态筛选选项 */
const statusOptions: SelectOption[] = [
  { value: 'all', label: '全部' },
  { value: 'completed', label: '已完成' },
  { value: 'pending', label: '待处理' },
  { value: 'failed', label: '失败' },
];

/** 资源类型筛选选项 */
const typeOptions: SelectOption[] = [
  { value: 'all', label: '全部' },
  { value: 'IMAGE', label: '图片' },
  { value: 'TEXT', label: '文本' },
  { value: 'VIDEO', label: '视频' },
  { value: 'AUDIO', label: '音频' },
];

/** 选中的资源 */
const selectedResource = ref<ResourceItem | null>(null);

/** 显示详情对话框 */
const showDetailDialog = ref(false);

/** 已加载所有数据 */
const hasLoadedAll = computed(() => resources.value.length >= total.value);

/** 过滤后的资源列表 */
const filteredResources = computed(() => {
  let filtered = resources.value;

  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(r => r.status === statusFilter.value);
  }

  if (typeFilter.value !== 'all') {
    filtered = filtered.filter(r => r.type === typeFilter.value);
  }

  return filtered;
});

/** 加载资源 */
async function loadResources(reset = false) {
  if (isLoading.value) return;

  if (reset) {
    currentPage.value = 0;
    resources.value = [];
  }

  isLoading.value = true;

  try {
    const result = await API.taskApi.listResources({
      skip: currentPage.value * pageSize,
      take: pageSize,
    });

    if (reset) {
      resources.value = result.resources;
    } else {
      resources.value.push(...result.resources);
    }

    total.value = result.total;
    currentPage.value++;
  } catch (error: any) {
    console.error('[ResourceGallery] 加载资源失败:', error);
    toast.add({
      summary: '加载失败',
      detail: error.message || '加载资源列表时发生错误',
      variant: 'error',
    });
  } finally {
    isLoading.value = false;
  }
}

/** 查看详情 */
function viewDetail(resource: any) {
  selectedResource.value = resource;
  showDetailDialog.value = true;
}

/** 获取图片 URL */
function getImageUrl(resource: ResourceItem): string {
  if (resource.file) {
    return `/api/fileApi/file/${resource.file.id}`;
  }
  if (resource.metadata && typeof resource.metadata === 'object' && !Array.isArray(resource.metadata)) {
    const metadata = resource.metadata as Record<string, unknown>;
    return (metadata.externalUrl as string) || '';
  }
  return '';
}

/** 检查资源是否有外部 URL */
function hasExternalUrl(resource: ResourceItem): boolean {
  if (!resource.metadata || typeof resource.metadata !== 'object' || Array.isArray(resource.metadata)) {
    return false;
  }
  const metadata = resource.metadata as Record<string, unknown>;
  return typeof metadata.externalUrl === 'string' && metadata.externalUrl.length > 0;
}

/** 格式化日期 */
function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString('zh-CN');
}

/** 获取状态标签样式 */
function getStatusBadgeClass(status: string): string {
  const baseClass = 'px-2 py-1 text-xs rounded ';
  switch (status) {
    case 'completed':
      return baseClass + 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'pending':
      return baseClass + 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'failed':
      return baseClass + 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return baseClass + 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}

/** 组件挂载时加载数据 */
onMounted(() => {
  loadResources(true);
});
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- 页面头部 -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        资源库
      </h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        管理你的 AI 生成资源
      </p>
    </div>

    <!-- 筛选器 -->
    <div class="mb-6 flex flex-wrap gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          状态
        </label>
        <Select
          v-model="statusFilter"
          :options="statusOptions"
          placeholder="全部"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          类型
        </label>
        <Select
          v-model="typeFilter"
          :options="typeOptions"
          placeholder="全部"
        />
      </div>
    </div>

    <!-- 资源列表 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
      <!-- 表格头部 -->
      <div class="grid grid-cols-12 gap-4 px-6 py-3 border-b border-gray-200 dark:border-gray-700 font-medium text-sm text-gray-700 dark:text-gray-300">
        <div class="col-span-1">预览</div>
        <div class="col-span-3">标题</div>
        <div class="col-span-2">类型</div>
        <div class="col-span-2">状态</div>
        <div class="col-span-2">创建时间</div>
        <div class="col-span-2">操作</div>
      </div>

      <!-- 加载中 -->
      <div v-if="isLoading && filteredResources.length === 0" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <p class="mt-2 text-gray-600 dark:text-gray-400">加载中...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="filteredResources.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p class="mt-2 text-gray-600 dark:text-gray-400">暂无资源</p>
      </div>

      <!-- 资源列表 -->
      <div v-else>
        <div
          v-for="resource in filteredResources"
          :key="resource.id"
          class="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <!-- 预览 -->
          <div class="col-span-1">
            <div v-if="resource.type === 'IMAGE'" class="w-12 h-12 rounded bg-gray-100 dark:bg-gray-600 overflow-hidden">
              <img
                v-if="resource.file || hasExternalUrl(resource)"
                :src="getImageUrl(resource)"
                :alt="resource.title"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div v-else class="w-12 h-12 rounded bg-gray-100 dark:bg-gray-600 flex items-center justify-center">
              <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <!-- 标题 -->
          <div class="col-span-3 flex items-center">
            <span class="text-gray-900 dark:text-gray-100 truncate">
              {{ resource.title }}
            </span>
          </div>

          <!-- 类型 -->
          <div class="col-span-2 flex items-center">
            <span class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
              {{ resource.type }}
            </span>
          </div>

          <!-- 状态 -->
          <div class="col-span-2 flex items-center">
            <span :class="getStatusBadgeClass(resource.status)">
              {{ resource.status }}
            </span>
          </div>

          <!-- 创建时间 -->
          <div class="col-span-2 flex items-center text-sm text-gray-600 dark:text-gray-400">
            {{ formatDate(resource.created) }}
          </div>

          <!-- 操作 -->
          <div class="col-span-2 flex items-center">
            <button
              type="button"
              class="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium"
              @click="viewDetail(resource)"
            >
              查看详情
            </button>
          </div>
        </div>
      </div>

      <!-- 加载更多 -->
      <div v-if="!hasLoadedAll && filteredResources.length > 0" class="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          :disabled="isLoading"
          @click="loadResources()"
        >
          <span v-if="isLoading">加载中...</span>
          <span v-else>加载更多</span>
        </button>
      </div>
    </div>

    <!-- 详情对话框 -->
    <Dialog
      v-if="selectedResource"
      v-model:open="showDetailDialog"
      title="资源详情"
    >
      <!-- 图片预览 -->
      <div v-if="selectedResource.type === 'IMAGE'" class="mb-6">
        <img
          :src="getImageUrl(selectedResource)"
          :alt="selectedResource.title"
          class="w-3/4 mx-auto rounded-lg border border-gray-200 dark:border-gray-700"
        />
      </div>

      <!-- 信息 -->
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            标题
          </label>
          <p class="text-gray-900 dark:text-gray-100">
            {{ selectedResource.title }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            描述
          </label>
          <p class="text-gray-600 dark:text-gray-400">
            {{ selectedResource.description || '无' }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            类型
          </label>
          <p class="text-gray-900 dark:text-gray-100">
            {{ selectedResource.type }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            状态
          </label>
          <span :class="getStatusBadgeClass(selectedResource.status)">
            {{ selectedResource.status }}
          </span>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            创建时间
          </label>
          <p class="text-gray-600 dark:text-gray-400">
            {{ formatDate(selectedResource.created) }}
          </p>
        </div>

        <div v-if="selectedResource.metadata">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            元数据
          </label>
          <pre class="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs overflow-auto max-h-40">{{ JSON.stringify(selectedResource.metadata, null, 2) }}</pre>
        </div>
      </div>
    </Dialog>
  </div>
</template>
