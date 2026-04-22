<template>
  <div class="min-h-screen bg-linear-to-br from-primary-50 to-primary-100 dark:from-primary-950 dark:to-primary-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <!-- Loading -->
      <div v-if="isLoading" class="flex justify-center items-center min-h-[400px]">
        <ProgressSpinner />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-12">
        <div
          class="inline-flex items-center justify-center w-16 h-16 bg-danger-100 dark:bg-danger-900/20 rounded-full mb-4">
          <i class="pi pi-exclamation-triangle text-2xl text-danger-600 dark:text-danger-400"></i>
        </div>
        <h2 class="text-2xl font-semibold text-primary-900 dark:text-primary-100 mb-2">
          {{ t('加载失败，请重试') }}
        </h2>
        <p class="text-primary-600 dark:text-primary-400 max-w-md mx-auto">
          {{ t('无法加载分享内容，请检查网络连接') }}
        </p>
      </div>

      <!-- Success -->
      <div v-else-if="state" class="space-y-8">
        <!-- Header Section -->
        <div class="text-center space-y-4">
          <h1 class="text-3xl md:text-4xl font-bold text-primary-900 dark:text-primary-100">
            <i class="pi pi-share-alt text-xl text-info-600 dark:text-info-400"></i>
            {{ state.data.title }}
          </h1>
          <p v-if="state.description" class="text-lg text-primary-600 dark:text-primary-400 max-w-2xl mx-auto">
            {{ state.description }}
          </p>
        </div>

        <!-- Files Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div v-for="file in state.data.files" :key="file.id"
            class="group bg-white dark:bg-primary-800 rounded-xl border border-primary-200 dark:border-primary-700 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 min-w-0">
            <!-- File Preview -->
            <div
              class="h-48 flex items-center justify-center bg-linear-to-br from-primary-50 to-primary-100 dark:from-primary-700 dark:to-primary-800">
              <ShareFilePreview :file="file" />
            </div>

            <!-- File Info -->
            <div class="p-6 space-y-4">
              <div>
                <div class="font-semibold text-primary-900 dark:text-primary-100 truncate" :title="file.filename">
                  {{ file.filename }}
                </div>

                <div class="flex items-center justify-between mt-2">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="getFileTypeClass(file.mimetype)">
                    {{ getFileTypeLabel(file.mimetype) }}
                  </span>
                  <span class="text-xs text-primary-500 dark:text-primary-400">
                    {{ formatFileSize(file.size) }}
                  </span>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="space-y-2">
                <Button class="w-full justify-center!" @click="openInNewTab(file)">
                  <i class="pi pi-external-link"></i>
                  <span>{{ t('新标签页打开') }}</span>
                </Button>

                <Button variant="secondary" class="w-full justify-center!" @click="downloadFile(file)">
                  <i class="pi pi-download"></i>
                  <span>{{ t('点击下载文件') }}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useAPI } from '@/api';
  import type { ShareFileJSON, ShareItemJSON } from '@/pages/admin/share/ShareDef';
  import { getFileTypeLabel } from '@/pages/admin/share/ShareDef';
  import { formatFileSize } from '@/utils/format';
  import ShareFilePreview from '@/pages/admin/share/ShareFilePreview.vue';
  import { authInfo_isLogin } from '@/storage';
  import { useAsyncState } from '@vueuse/core';
  import { useI18n } from '@/composables/useI18n';
  import { useToast } from '@/composables/useToast';
  import { getErrorMessage } from '@/utils/error';
  import { Button } from '@/components/base';

  const { AppAPI, APIGetUrl, AppAPIGetUrl } = useAPI();
  const { t } = useI18n();
  const toast = useToast();
  const { id } = defineProps<{ id: string }>();

  const { state, isLoading, error } = useAsyncState(() => {
    return AppAPI.shareApi.detail(Number(id)) as unknown as Promise<ShareItemJSON>;
  }, undefined);

  const getFileTypeClass = (mimetype: string) => {
    if (mimetype.startsWith('image/'))
      return 'bg-info-100 text-info-800 dark:bg-info-900 dark:text-info-200';
    if (mimetype.startsWith('video/'))
      return 'bg-secondary-100 text-secondary-800 dark:bg-secondary-900 dark:text-secondary-200';
    if (mimetype.startsWith('audio/'))
      return 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200';
    if (mimetype.includes('pdf') || mimetype.includes('document'))
      return 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200';
    if (mimetype.includes('zip') || mimetype.includes('archive'))
      return 'bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-200';
    return 'bg-primary-100 text-primary-800 dark:bg-primary-700 dark:text-primary-200';
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
    } catch (error: unknown) {
      toast.error(t('下载文件失败'), getErrorMessage(error));
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
    } catch (error: unknown) {
      toast.error(t('打开文件失败'), getErrorMessage(error));
    }
  }
</script>
