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
  <!-- 文本文件预览 -->
  <div v-if="isTextFile(file.mimetype)" class="h-full w-full">
    <div v-if="textContent === undefined" class="flex justify-center items-center h-full">
      <ProgressSpinner />
    </div>
    <ShareCodeMirror v-else :content="textContent" :filename="file.filename" read-only />
  </div>

  <!-- 加密二进制文件：使用解密后的 Blob URL -->
  <template v-else-if="cryptoInstance">
    <div v-if="binaryLoading" class="flex justify-center items-center h-full">
      <ProgressSpinner />
    </div>
    <template v-else-if="decryptedUrl">
      <!-- 图片预览 -->
      <img
        v-if="file.mimetype.startsWith('image/')"
        :src="decryptedUrl"
        class="max-w-full max-h-full object-contain mx-auto"
        :alt="file.filename"
      />
      <!-- 视频预览 -->
      <video
        v-else-if="file.mimetype.startsWith('video/')"
        :src="decryptedUrl"
        controls
        class="h-full w-full object-contain"
        :title="file.filename"
        preload="metadata"
      >
        {{ t("您的浏览器不支持视频播放。") }}
      </video>
      <!-- 其他文件 -->
      <div v-else class="file-preview">
        <div class="file-icon flex items-center justify-center">
          <i class="pi pi-file text-3xl! text-primary-subtle"></i>
        </div>
        <div class="flex flex-col items-center">
          <div class="font-medium text-sm mb-2">{{ file.filename }}</div>
          <div class="text-xs text-primary-theme mb-4">{{ formatFileSize(file.size) }}</div>
          <a :href="decryptedUrl" :download="file.filename" class="download-link">
            <i class="pi pi-download mr-1"></i>{{ t("下载") }}
          </a>
        </div>
      </div>
    </template>
  </template>

  <!-- 非加密二进制文件预览 -->
  <File2Url v-else-if="file?.id !== undefined" :fileId="file.id" v-slot="{ url }">
    <!-- 图片预览 -->
    <img
      v-if="file.mimetype.startsWith('image/')"
      :src="url"
      class="max-w-full max-h-full object-contain"
      :alt="file.filename"
    />

    <!-- 视频预览（浏览器自动用 Range 请求流式播放） -->
    <video
      v-else-if="file.mimetype.startsWith('video/')"
      :src="url"
      controls
      class="h-full w-full object-contain"
      :title="file.filename"
      preload="metadata"
    >
      {{ t("您的浏览器不支持视频播放。") }}
    </video>

    <!-- 其他文件类型 -->
    <div v-else class="file-preview">
      <div class="file-icon flex items-center justify-center">
        <i class="pi pi-file text-3xl! text-primary-subtle"></i>
      </div>
      <div class="flex flex-col items-center">
        <div class="font-medium text-sm mb-2">
          {{ file.filename }}
        </div>
        <div class="text-xs text-primary-theme mb-4">
          {{ formatFileSize(file.size) }}
        </div>
        <a :href="url" :download="file.filename" class="download-link">
          <i class="pi pi-download mr-1"></i>
          {{ t("下载") }}
        </a>
      </div>
    </div>
  </File2Url>
</template>
<script setup lang="ts">
import File2Url from "@/pages/admin/components/File2Url.vue";
import { type ShareFileJSON, isTextFile } from "@/pages/admin/share/ShareDef";
import ShareCodeMirror from "@/pages/share/ShareCodeMirror.vue";
import { useAPI } from "@/api";
import { authInfo_isLogin } from "@/storage";
import { useI18n } from "@/composables/useI18n";
import { formatFileSize } from "@/utils/format";
import { ref, watch } from "vue";
import type { ShareCrypto } from "@/utils/shareCrypto";

const { AppAPIGetUrl, APIGetUrl } = useAPI();
const { t } = useI18n();

interface ShareFilePreviewProps {
  file: ShareFileJSON;
  /** 加密实例，传入则文件内容会被解密后展示 */
  cryptoInstance?: ShareCrypto;
}

const { file, cryptoInstance } = defineProps<ShareFilePreviewProps>();

/** 解密后的二进制文件 Blob URL（加密分享用） */
const decryptedUrl = ref("");
const binaryLoading = ref(false);

/** 文本文件内容 */
const textContent = ref<string | undefined>(undefined);

/** 获取文件 URL */
async function getFileUrl(fileId: number) {
  return authInfo_isLogin.value
    ? await APIGetUrl.fileApi.file(fileId)
    : await AppAPIGetUrl.fileApi.file(fileId);
}

watch(
  () => [file.id, cryptoInstance] as const,
  async ([fileId, crypto]) => {
    if (fileId === undefined) {
      textContent.value = undefined;
      decryptedUrl.value = "";
      return;
    }

    /** 文本文件 */
    if (isTextFile(file.mimetype)) {
      try {
        const url = await getFileUrl(fileId);
        const response = await fetch(url);
        if (crypto) {
          const encryptedBuffer = await response.arrayBuffer();
          const decryptedBuffer = await crypto.decryptBytes(encryptedBuffer);
          textContent.value = new TextDecoder().decode(decryptedBuffer);
        } else {
          textContent.value = await response.text();
        }
      } catch {
        textContent.value = "";
      }
    } else {
      /** 二进制文件：如果有加密实例，fetch 并解密为 Blob URL */
      if (crypto) {
        binaryLoading.value = true;
        try {
          const url = await getFileUrl(fileId);
          const response = await fetch(url);
          const encryptedBuffer = await response.arrayBuffer();
          const decryptedBuffer = await crypto.decryptBytes(encryptedBuffer);
          const blob = new Blob([decryptedBuffer], { type: file.mimetype });
          decryptedUrl.value = URL.createObjectURL(blob);
        } catch {
          decryptedUrl.value = "";
        } finally {
          binaryLoading.value = false;
        }
      } else {
        decryptedUrl.value = "";
      }
    }
  },
  { immediate: true },
);
</script>
