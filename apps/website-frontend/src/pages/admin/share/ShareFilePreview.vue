<style scoped>
.video-container {
  max-width: 100%;
  max-height: 100%;
}

.file-icon {
  width: 64px;
  height: 64px;
}

.file-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
}

.download-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
}

.download-link:hover {
  text-decoration: underline;
}
</style>
<template>
  <File2Url v-if="file?.id !== undefined" :fileId="file.id" v-slot="{ url }">
    <!-- 图片预览 -->
    <img v-if="file.mimetype.startsWith('image/')" :src="url" class="h-full w-full object-cover" :alt="file.filename" />

    <!-- 视频预览（浏览器自动用 Range 请求流式播放） -->
    <video v-else-if="file.mimetype.startsWith('video/')" :src="url" controls
      class="h-full w-full object-contain"
      :title="file.filename" preload="metadata">
      您的浏览器不支持视频播放。
    </video>

    <!-- 其他文件类型 -->
    <div v-else class="file-preview ">
      <div class="file-icon flex items-center justify-center">
        <i class="pi pi-file text-3xl!" :class="{ 'text-primary-500': !isDark, 'text-primary-400': isDark }"></i>
      </div>
      <div class="flex flex-col items-center">
        <div class="font-medium text-sm mb-2">
          {{ file.filename }}
        </div>
        <div class="text-xs text-primary-600 dark:text-primary-400 mb-4 ">
          {{ formatFileSize(file.size) }}
        </div>
        <a :href="url" :download="file.filename" class="download-link">
          <i class="pi pi-download mr-1"></i>
          {{ t('下载') }}
        </a>
      </div>
    </div>
  </File2Url>
</template>
<script setup lang="ts">
  import File2Url from '@/pages/admin/components/File2Url.vue';
  import { type ShareFileJSON } from '@/pages/admin/share/ShareDef';
  import { useDark } from '@vueuse/core';
  import { useI18n } from '@/composables/useI18n';
  import { formatFileSize } from '@/utils/format';

  const { t } = useI18n();

  interface ShareFilePreviewProps {
    file: ShareFileJSON;
  }

  defineProps<ShareFilePreviewProps>();

  const isDark = useDark();
</script>
