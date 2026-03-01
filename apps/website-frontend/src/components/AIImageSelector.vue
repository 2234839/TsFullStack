<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAPI } from '@/api';
import { Dialog } from '@tsfullstack/shared-frontend/components';

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
const resources = ref<any[]>([]);

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
      resources.value = result.resources;
    } else {
      resources.value.push(...result.resources);
    }

    total.value = result.total;
    currentPage.value++;
  } catch (error: any) {
    console.error('[AIImageSelector] 加载资源失败:', error);
    toast.add({
      summary: '加载失败',
      detail: error.message || '加载图片列表时发生错误',
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
    // TODO: 实现搜索功能
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
function selectImage(resource: any) {
  if (!resource.fileId) {
    toast.add({
      summary: '图片未下载',
      detail: '此图片还未下载到本地',
      variant: 'warning',
    });
    return;
  }

  emit('select', resource.fileId);
  emit('close');
}

/** 获取图片 URL */
function getImageUrl(resource: any): string {
  if (resource.file) {
    return `/api/fileApi/file/${resource.file.id}`;
  }
  // 从 metadata 中获取 externalUrl
  return resource.metadata?.externalUrl || '';
}

/** 格式化日期 */
function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('zh-CN');
}

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
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          选择 AI 图片
        </h3>
      </div>

      <!-- 搜索框 -->
      <div class="flex gap-2">
        <input
          v-model="searchQuery"
          type="text"
          class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          placeholder="搜索图片..."
          @keyup.enter="searchImages"
        />
        <button
          type="button"
          class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          @click="searchImages"
        >
          搜索
        </button>
      </div>
    </template>

    <!-- 图片列表 -->
    <div class="max-h-[60vh] overflow-auto">
      <div v-if="isLoading && resources.length === 0" class="text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <p class="mt-2 text-gray-600 dark:text-gray-400">加载中...</p>
      </div>

      <div v-else-if="resources.length === 0" class="text-center py-8">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p class="mt-2 text-gray-600 dark:text-gray-400">暂无图片</p>
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        <div
          v-for="resource in resources"
          :key="resource.id"
          class="relative group cursor-pointer border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary-500 transition-all"
          @click="selectImage(resource)"
        >
          <img
            :src="getImageUrl(resource)"
            :alt="resource.title"
            class="w-full aspect-square object-cover"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
            <div class="text-white text-sm">
              <p class="font-medium truncate">{{ resource.title }}</p>
              <p class="text-xs opacity-75">{{ formatDate(resource.created) }}</p>
            </div>
          </div>
          <div v-if="!resource.fileId" class="absolute top-2 right-2">
            <span class="px-2 py-1 bg-yellow-500 text-white text-xs rounded">
              未下载
            </span>
          </div>
        </div>
      </div>

      <!-- 加载更多 -->
      <div v-if="!hasLoadedAll && resources.length > 0" class="text-center mt-6">
        <button
          type="button"
          class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          :disabled="isLoading"
          @click="loadResources()"
        >
          <span v-if="isLoading">加载中...</span>
          <span v-else>加载更多</span>
        </button>
      </div>
    </div>

    <!-- 底部信息 -->
    <template #footer>
      <div class="bg-gray-50 dark:bg-gray-900">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          共 {{ total }} 张图片
        </p>
      </div>
    </template>
  </Dialog>
</template>
