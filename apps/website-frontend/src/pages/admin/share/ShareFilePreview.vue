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
  <File2Url :fileId="file.id" v-slot="{ url }">
    <!-- 图片预览 -->
    <img
      v-if="file.mimetype.startsWith('image/')"
      :src="url"
      class="h-full"
      :alt="file.filename"
    />

    <!-- 视频预览 -->
    <video
      v-else-if="file.mimetype.startsWith('video/')"
      :src="url"
      controls
      class="video-container h-full"
      :title="file.filename"
    >
      您的浏览器不支持视频播放。
    </video>

    <!-- 其他文件类型 -->
    <div v-else class="file-preview">
      <div class="file-icon">
        <i
          class="pi pi-file text-4xl"
          :class="{ 'text-blue-500': !isDark, 'text-blue-400': isDark }"
        ></i>
      </div>
      <div class="text-center">
        <div class="font-medium text-lg mb-2">{{ file.filename }}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {{ formatFileSize(file.size) }}
        </div>
        <a
          :href="url"
          :download="file.filename"
          class="download-link"
        >
          <i class="pi pi-download mr-1"></i>
          {{ $t('下载') }}
        </a>
      </div>
    </div>
  </File2Url>
</template>
<script setup lang="ts">
  import File2Url from '@/pages/admin/components/File2Url.vue';
  import { type ShareFileJSON } from '@/pages/admin/share/ShareDef';
  import { useDark } from '@vueuse/core';

  const props = defineProps({
    file: {
      type: null as unknown as () => ShareFileJSON,
      required: true,
    },
  });

  const isDark = useDark();

  /** 格式化文件大小 */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
</script>
