<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAPI } from '@/api';
import { Dialog } from '@tsfullstack/shared-frontend/components';
import { Button, Input } from '@/components/base';
import { getErrorMessage } from '@/utils/error';
import { getResourceUrl } from '@/utils/resource';

/** 资源项（与后端 listResources 返回的 select 字段一致） */
interface ResourceItem {
  id: number;
  type: string;
  title: string;
  status: string;
  taskId: number;
  created: Date;
  file: { id: number; filename: string; mimetype: string; size: number } | null;
  task: { id: number; type: string; title: string };
}

const props = defineProps<{
  open?: boolean;
}>();

const emit = defineEmits<{
  select: [fileId: number];
  close: [];
}>();

/** 本地的 open 状态，支持双向绑定 */
const localOpen = computed({
  get: () => props.open || false,
  set: (value) => {
    if (!value) {
      emit('close');
    }
  },
});

const toast = useToast();
const { API } = useAPI();

/** 资源列表 */
const resources = ref<ResourceItem[]>([]);

/** 总数 */
const total = ref(0);

/** 加载中 */
const isLoading = ref(false);

/** 当前页 */
const currentPage = ref(0);

/** 每页数量 */
const pageSize = 20;

/** 搜索关键词 */
const searchQuery = ref('');

/** 已加载所有数据 */
const hasLoadedAll = computed(() => resources.value.length >= total.value);

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
      type: 'IMAGE',
      status: 'completed',
      skip: currentPage.value * pageSize,
      take: pageSize,
    });

    if (reset) {
      resources.value = result.items;
    } else {
      resources.value.push(...result.items);
    }

    total.value = result.total;
    currentPage.value++;
  } catch (error: unknown) {
    const message = getErrorMessage(error, '加载图片列表时发生错误');
    toast.add({
      summary: '加载失败',
      detail: message,
      variant: 'error',
    });
  } finally {
    isLoading.value = false;
  }
}

/** 搜索图片 */
async function searchImages() {
  currentPage.value = 0;
  resources.value = [];

  if (searchQuery.value.trim()) {
    /** 搜索功能待实现：需要后端 listResources 支持关键词过滤 */
    toast.add({
      summary: '搜索功能',
      detail: '搜索功能正在开发中',
      variant: 'info',
    });
  } else {
    await loadResources(true);
  }
}

/** 选择图片 */
function selectImage(resource: ResourceItem) {
  if (!resource.file?.id) {
    toast.add({
      summary: '图片未下载',
      detail: '此图片还未下载到本地',
      variant: 'warning',
    });
    return;
  }

  emit('select', resource.file?.id);
  emit('close');
}

/** 获取图片 URL */
function getImageUrl(resource: ResourceItem): string {
  return getResourceUrl(resource);
}

import { formatDate } from '@/utils/format';

/** 组件挂载时加载数据 */
onMounted(() => {
  if (props.open) {
    loadResources(true);
  }
});
</script>

<template>
  <Dialog
    v-model:open="localOpen"
    title="选择 AI 图片"
  >
    <template #header>
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold text-primary-900 dark:text-primary-100">
          选择 AI 图片
        </h3>
      </div>

      <!-- 搜索框 -->
      <div class="flex gap-2">
        <Input
          v-model="searchQuery"
          placeholder="搜索图片..."
          @keyup.enter="searchImages"
        />
        <Button @click="searchImages">
          搜索
        </Button>
      </div>
    </template>

    <!-- 图片列表 -->
    <div class="max-h-[60vh] overflow-auto">
      <div v-if="isLoading && resources.length === 0" class="text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <p class="mt-2 text-secondary-600 dark:text-secondary-400">加载中...</p>
      </div>

      <div v-else-if="resources.length === 0" class="text-center py-8">
        <svg class="mx-auto h-12 w-12 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p class="mt-2 text-secondary-600 dark:text-secondary-400">暂无图片</p>
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        <div
          v-for="resource in resources"
          :key="resource.id"
          class="relative group cursor-pointer border border-primary-200 dark:border-primary-700 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary-500 transition-all"
          @click="selectImage(resource)"
        >
          <img
            :src="getImageUrl(resource)"
            :alt="resource.title"
            class="w-full aspect-square object-cover"
          />
          <div class="absolute inset-0 bg-linear-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
            <div class="text-white text-sm">
              <p class="font-medium truncate">{{ resource.title }}</p>
              <p class="text-xs opacity-75">{{ formatDate(resource.created, { dateOnly: true }) }}</p>
            </div>
          </div>
          <div v-if="!resource.file?.id" class="absolute top-2 right-2">
            <span class="px-2 py-1 bg-warning-500 text-white text-xs rounded">
              未下载
            </span>
          </div>
        </div>
      </div>

      <!-- 加载更多 -->
      <div v-if="!hasLoadedAll && resources.length > 0" class="text-center mt-6">
        <Button
          variant="secondary"
          :disabled="isLoading"
          :loading="isLoading"
          @click="loadResources()"
        >
          {{ isLoading ? '加载中...' : '加载更多' }}
        </Button>
      </div>
    </div>

    <!-- 底部信息 -->
    <template #footer>
      <div class="bg-secondary-50 dark:bg-secondary-900">
        <p class="text-sm text-secondary-600 dark:text-secondary-400">
          共 {{ total }} 张图片
        </p>
      </div>
    </template>
  </Dialog>
</template>
