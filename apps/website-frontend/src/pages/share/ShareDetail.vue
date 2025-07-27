<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center items-center min-h-[400px]">
      <ProgressSpinner />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <i class="pi pi-exclamation-triangle text-4xl text-red-500 mb-4"></i>
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
        {{ $t('加载失败，请重试') }}
      </h2>
      <p class="text-gray-600 dark:text-gray-300 mt-2">
        {{ $t('无法加载分享内容，请检查网络连接') }}
      </p>
    </div>

    <!-- Success -->
    <div v-else-if="state">
      <div class="text-center mb-12">
        <h1 class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
          {{ state.data.title }}
        </h1>
        <p
          v-if="state.description"
          class="mt-3 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          {{ state.description }}
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="file in state.data.files"
          :key="file.id"
          class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
          <div class="h-48 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
            <ShareFilePreview :file="file" />
          </div>

          <div class="p-5">
            <div
              class="font-semibold text-gray-900 dark:text-white truncate"
              :title="file.filename">
              {{ file.filename }}
            </div>

            <div class="flex justify-between items-center mt-3">
              <span
                class="px-3 py-1 text-xs font-medium rounded-full"
                :class="getFileTypeClass(file.mimetype)">
                {{ getFileTypeLabel(file.mimetype) }}
              </span>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatFileSize(file.size) }}
              </span>
            </div>

            <button
              @click="downloadFile(file)"
              class="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200">
              <i class="pi pi-download"></i>
              {{ $t('点击下载文件') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useAPI } from '@/api';
  import type { ShareFileJSON, ShareItemJSON } from '@/pages/admin/share/ShareDef';
  import { getFileTypeLabel, formatFileSize } from '@/pages/admin/share/ShareDef';
  import ShareFilePreview from '@/pages/admin/share/ShareFilePreview.vue';
  import { authInfo_isLogin } from '@/storage';
  import { useAsyncState } from '@vueuse/core';

  const { AppAPI, APIGetUrl, AppAPIGetUrl } = useAPI();
  const props = defineProps({
    id: String,
  });

  const { state, isLoading, error } = useAsyncState(() => {
    return AppAPI.shareApi.detail(Number(props.id)) as unknown as Promise<ShareItemJSON>;
  }, undefined);

  const getFileTypeClass = (mimetype: string) => {
    if (mimetype.startsWith('image/'))
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (mimetype.startsWith('video/'))
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    if (mimetype.startsWith('audio/'))
      return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
    if (mimetype.includes('pdf') || mimetype.includes('document'))
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (mimetype.includes('zip') || mimetype.includes('archive'))
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  async function downloadFile(file: ShareFileJSON) {
    try {
      let url = '';
      if (authInfo_isLogin.value) {
        url = await APIGetUrl.fileApi.file(file.id);
      } else {
        url = await AppAPIGetUrl.fileApi.file(file.id);
      }

      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('下载文件失败:', error);
    }
  }
</script>
