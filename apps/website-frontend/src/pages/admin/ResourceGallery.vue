<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useAPI } from '@/api';
import { Button } from '@/components/base';
import { Dialog, Select } from '@tsfullstack/shared-frontend/components';
import type { SelectOption } from '@tsfullstack/shared-frontend/components';
import { getErrorMessage } from '@/utils/error';
import { getResourceUrl } from '@/utils/resource';

const toast = useToast();
const { t } = useI18n();
const { API } = useAPI();

/** 资源项（与后端 listResources 返回的 select 字段一致，附加前端展示字段） */
interface ResourceItem {
  id: number;
  type: string;
  title: string;
  description?: string | null;
  status: string;
  taskId: number;
  created: Date;
  metadata?: unknown;
  file: { id: number; filename: string; mimetype: string; size: number } | null;
  task: { id: number; type: string; title: string };
}

/** 资源列表 */
const resources = ref<ResourceItem[]>([]);

/** 任务列表 */

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

/** 状态筛选选项（使用 computed 确保切换语言后更新） */
const statusOptions = computed<SelectOption[]>(() => [
  { value: 'all', label: t('全部') },
  { value: 'completed', label: t('已完成') },
  { value: 'pending', label: t('待处理') },
  { value: 'failed', label: t('失败') },
]);

/** 资源类型筛选选项（使用 computed 确保切换语言后更新） */
const typeOptions = computed<SelectOption[]>(() => [
  { value: 'all', label: t('全部') },
  { value: 'IMAGE', label: t('图片') },
  { value: 'TEXT', label: t('文本') },
  { value: 'VIDEO', label: t('视频') },
  { value: 'AUDIO', label: t('音频') },
]);

/** 选中的资源 */
const selectedResource = ref<ResourceItem | null>(null);

/** 显示详情对话框 */
const showDetailDialog = ref(false);

/** 已加载所有数据 */
const hasLoadedAll = computed(() => resources.value.length >= total.value);

/** 过滤后的资源列表（组合过滤：status 和 type 同时生效） */
const filteredResources = computed(() => {
  const list = resources.value ?? [];
  return list.filter(r =>
    (statusFilter.value === 'all' || r.status === statusFilter.value) &&
    (typeFilter.value === 'all' || r.type === typeFilter.value),
  );
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

    const items = Array.isArray(result?.items) ? result.items : [];
    if (reset) {
      resources.value = items;
    } else {
      resources.value.push(...items);
    }

    total.value = result?.total ?? 0;
    currentPage.value++;
  } catch (error: unknown) {
    toast.add({
      summary: t('加载失败'),
      detail: getErrorMessage(error, t('加载资源列表时发生错误')),
      variant: 'error',
    });
  } finally {
    isLoading.value = false;
  }
}

/** 获取资源状态标签（i18n 映射） */
function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    completed: t('已完成'),
    pending: t('待处理'),
    failed: t('失败'),
  };
  return map[status] || status;
}

/** 获取资源类型标签（i18n 映射） */
function getTypeLabel(type: string): string {
  const map: Record<string, string> = {
    IMAGE: t('图片'),
    TEXT: t('文本'),
    VIDEO: t('视频'),
    AUDIO: t('音频'),
  };
  return map[type] || type;
}

/** 查看详情 */
function viewDetail(resource: ResourceItem) {
  selectedResource.value = resource;
  showDetailDialog.value = true;
}

/** 获取图片 URL */
function getImageUrl(resource: ResourceItem): string {
  return getResourceUrl(resource);
}

/** 检查资源是否有外部 URL */
function hasExternalUrl(resource: ResourceItem): boolean {
  if (!resource.metadata || typeof resource.metadata !== 'object' || Array.isArray(resource.metadata)) {
    return false;
  }
  const metadata = resource.metadata as Record<string, unknown>;
  return typeof metadata.externalUrl === 'string' && metadata.externalUrl.length > 0;
}

import { formatDate } from '@/utils/format';

/** 获取状态标签样式 */
function getStatusBadgeClass(status: string): string {
  const baseClass = 'px-2 py-1 text-xs rounded ';
  switch (status) {
    case 'completed':
      return baseClass + 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200';
    case 'pending':
      return baseClass + 'bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-200';
    case 'failed':
      return baseClass + 'bg-danger-100 text-danger-800 dark:bg-danger-900 dark:text-danger-200';
    default:
      return baseClass + 'bg-primary-100 text-primary-800 dark:bg-primary-700 dark:text-primary-300';
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
      <h1 class="text-3xl font-bold text-primary-900 dark:text-primary-100">
        {{ t('资源库') }}
      </h1>
      <p class="mt-2 text-primary-600 dark:text-primary-400">
        {{ t('管理你的 AI 生成资源') }}
      </p>
    </div>

    <!-- 筛选器 -->
    <div class="mb-6 flex flex-wrap gap-4">
      <div>
        <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
          {{ t('状态') }}
        </label>
        <Select
          v-model="statusFilter"
          :options="statusOptions"
          :placeholder="t('全部')"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
          {{ t('类型') }}
        </label>
        <Select
          v-model="typeFilter"
          :options="typeOptions"
          :placeholder="t('全部')"
        />
      </div>
    </div>

    <!-- 资源列表 -->
    <div class="bg-white dark:bg-primary-800 rounded-lg shadow">
      <!-- 表格头部 -->
      <div class="grid grid-cols-12 gap-4 px-6 py-3 border-b border-primary-200 dark:border-primary-700 font-medium text-sm text-primary-700 dark:text-primary-300">
        <div class="col-span-1">{{ t('预览') }}</div>
        <div class="col-span-3">{{ t('标题') }}</div>
        <div class="col-span-2">{{ t('类型') }}</div>
        <div class="col-span-2">{{ t('状态') }}</div>
        <div class="col-span-2">{{ t('创建时间') }}</div>
        <div class="col-span-2">{{ t('操作') }}</div>
      </div>

      <!-- 加载中 -->
      <div v-if="isLoading && filteredResources.length === 0" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <p class="mt-2 text-primary-600 dark:text-primary-400">{{ t('加载中...') }}</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="filteredResources.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p class="mt-2 text-primary-600 dark:text-primary-400">{{ t('暂无资源') }}</p>
      </div>

      <!-- 资源列表 -->
      <div v-else>
        <div
          v-for="resource in filteredResources"
          :key="resource.id"
          class="grid grid-cols-12 gap-4 px-6 py-4 border-b border-primary-200 dark:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-700 transition-colors"
        >
          <!-- 预览 -->
          <div class="col-span-1">
            <div v-if="resource.type === 'IMAGE'" class="w-12 h-12 rounded bg-primary-100 dark:bg-primary-600 overflow-hidden">
              <img
                v-if="resource.file || hasExternalUrl(resource)"
                :src="getImageUrl(resource)"
                :alt="resource.title"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-primary-400">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div v-else class="w-12 h-12 rounded bg-primary-100 dark:bg-primary-600 flex items-center justify-center">
              <svg class="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <!-- 标题 -->
          <div class="col-span-3 flex items-center">
            <span class="text-primary-900 dark:text-primary-100 truncate">
              {{ resource.title }}
            </span>
          </div>

          <!-- 类型 -->
          <div class="col-span-2 flex items-center">
            <span class="px-2 py-1 text-xs bg-primary-100 dark:bg-primary-700 text-primary-700 dark:text-primary-300 rounded">
              {{ getTypeLabel(resource.type) }}
            </span>
          </div>

          <!-- 状态 -->
          <div class="col-span-2 flex items-center">
            <span :class="getStatusBadgeClass(resource.status)">
              {{ getStatusLabel(resource.status) }}
            </span>
          </div>

          <!-- 创建时间 -->
          <div class="col-span-2 flex items-center text-sm text-primary-600 dark:text-primary-400">
            {{ formatDate(resource.created) }}
          </div>

          <!-- 操作 -->
          <div class="col-span-2 flex items-center">
            <Button
              variant="text"
              size="sm"
              @click="viewDetail(resource)"
            >
              {{ t('查看详情') }}
            </Button>
          </div>
        </div>
      </div>

      <!-- 加载更多 -->
      <div v-if="!hasLoadedAll && filteredResources.length > 0" class="px-6 py-4 border-t border-primary-200 dark:border-primary-700">
        <Button
          variant="secondary"
          class="w-full"
          :disabled="isLoading"
          @click="loadResources()"
        >
          <span v-if="isLoading">{{ t('加载中...') }}</span>
          <span v-else>{{ t('加载更多') }}</span>
        </Button>
      </div>
    </div>

    <!-- 详情对话框 -->
    <Dialog
      v-if="selectedResource"
      v-model:open="showDetailDialog"
      :title="t('资源详情')"
    >
      <!-- 图片预览 -->
      <div v-if="selectedResource.type === 'IMAGE'" class="mb-6">
        <img
          :src="getImageUrl(selectedResource)"
          :alt="selectedResource.title"
          class="w-3/4 mx-auto rounded-lg border border-primary-200 dark:border-primary-700"
        />
      </div>

      <!-- 信息 -->
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
            {{ t('标题') }}
          </label>
          <p class="text-primary-900 dark:text-primary-100">
            {{ selectedResource.title }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
            {{ t('描述') }}
          </label>
          <p class="text-primary-600 dark:text-primary-400">
            {{ selectedResource.description || t('无') }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
            {{ t('类型') }}
          </label>
          <p class="text-primary-900 dark:text-primary-100">
            {{ selectedResource.type }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
            {{ t('状态') }}
          </label>
          <span :class="getStatusBadgeClass(selectedResource.status)">
            {{ selectedResource.status }}
          </span>
        </div>

        <div>
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
            {{ t('创建时间') }}
          </label>
          <p class="text-primary-600 dark:text-primary-400">
            {{ formatDate(selectedResource.created) }}
          </p>
        </div>

        <div v-if="selectedResource.metadata">
          <label class="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
            {{ t('元数据') }}
          </label>
          <pre class="bg-primary-100 dark:bg-primary-900 p-3 rounded text-xs overflow-auto max-h-40">{{ JSON.stringify(selectedResource.metadata, null, 2) }}</pre>
        </div>
      </div>
    </Dialog>
  </div>
</template>
