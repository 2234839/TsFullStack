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

    <!-- 视频预览（点击后才开始加载，避免自动下载大文件） -->
    <div v-else-if="file.mimetype.startsWith('video/')" class="relative h-full w-full flex items-center justify-center bg-secondary-900 dark:bg-secondary-950 cursor-pointer group"
      @click="loadVideo(url)">
      <video v-if="videoSrc" :src="videoSrc" controls class="video-container absolute inset-0 w-full h-full"
        :title="file.filename" @loadeddata="videoLoaded = true">
        您的浏览器不支持视频播放。
      </video>
      <!-- 未加载时显示占位 -->
      <template v-if="!videoSrc">
        <div class="flex flex-col items-center gap-2 text-secondary-300 z-10">
          <i class="pi pi-play-circle text-4xl group-hover:text-white transition-colors"></i>
          <span class="text-xs">{{ file.filename }}</span>
          <span class="text-xs opacity-60">{{ formatFileSize(file.size) }}</span>
          <span class="text-xs opacity-40 mt-1">{{ t('点击播放') }}</span>
        </div>
      </template>
    </div>

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
  import { ref } from 'vue';
  import { useDark } from '@vueuse/core';
  import { useI18n } from '@/composables/useI18n';

  const { t } = useI18n();

  interface ShareFilePreviewProps {
    file: ShareFileJSON;
  }

  defineProps<ShareFilePreviewProps>();

  const isDark = useDark();
  /** 视频元数据是否已加载（用于隐藏占位） */
  const videoLoaded = ref(false)
  /** 视频源（点击后才设置，避免自动下载） */
  const videoSrc = ref('')

  /** 点击占位区域后加载视频 */
  function loadVideo(src: string) {
    videoSrc.value = src
  }

  /** 格式化文件大小（从 utils/format 统一导入） */
  import { formatFileSize } from '@/utils/format';
</script>
