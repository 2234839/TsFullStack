<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <!-- Loading -->
      <div v-if="isLoading" class="flex justify-center items-center min-h-[400px]">
        <ProgressSpinner />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-12">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
          <i class="pi pi-exclamation-triangle text-2xl text-red-600 dark:text-red-400"></i>
        </div>
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          {{ $t('加载失败，请重试') }}
        </h2>
        <p class="text-gray-600 dark:text-gray-300 max-w-md mx-auto">
          {{ $t('无法加载分享内容，请检查网络连接') }}
        </p>
      </div>

      <!-- Success -->
      <div v-else-if="state" class="space-y-8">
        <!-- Header Section -->
        <div class="text-center space-y-4">
          <div class="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full">
            <i class="pi pi-share-alt text-xl text-blue-600 dark:text-blue-400"></i>
          </div>
          <h1 class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            {{ state.data.title }}
          </h1>
          <p
            v-if="state.description"
            class="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {{ state.description }}
          </p>
        </div>

        <!-- Files Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="file in state.data.files"
            :key="file.id"
            class="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
            <!-- File Preview -->
            <div class="h-48 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
              <ShareFilePreview :file="file" />
            </div>

            <!-- File Info -->
            <div class="p-6 space-y-4">
              <div>
                <div
                  class="font-semibold text-gray-900 dark:text-white truncate"
                  :title="file.filename">
                  {{ file.filename }}
                </div>

                <div class="flex items-center justify-between mt-2">
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="getFileTypeClass(file.mimetype)">
                    {{ getFileTypeLabel(file.mimetype) }}
                  </span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ formatFileSize(file.size) }}
                  </span>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="space-y-2">
                <!-- Open in New Tab Button for All Files -->
                <button
                  @click="openInNewTab(file)"
                  class="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]">
                  <i class="pi pi-external-link"></i>
                  <span>{{ $t('新标签页打开') }}</span>
                </button>

                <!-- Download Button -->
                <button
                  @click="downloadFile(file)"
                  class="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]">
                  <i class="pi pi-download"></i>
                  <span>{{ $t('点击下载文件') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
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

  
  async function openInNewTab(file: ShareFileJSON) {
    try {
      let url = '';
      if (authInfo_isLogin.value) {
        url = await APIGetUrl.fileApi.file(file.id);
      } else {
        url = await AppAPIGetUrl.fileApi.file(file.id);
      }

      window.open(url, '_blank');
    } catch (error) {
      console.error('打开文件失败:', error);
    }
  }
</script>
