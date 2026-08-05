<style scoped></style>
<template>
  <div class="bg-primary-100 dark:bg-primary-700">
    <!-- 加密分享：显示加密占位图 -->
    <div v-if="isEncrypted" class="h-48 w-full flex items-center justify-center">
      <div class="flex flex-col items-center text-primary-subtle">
        <i class="pi pi-lock text-4xl mb-2" />
        <span class="text-xs">{{ t("加密分享") }}</span>
      </div>
    </div>
    <!-- 非加密分享：文件预览轮播 -->
    <Carousel v-else :value="data.data.files ?? []" :numVisible="1" :numScroll="1" :circular="true">
      <template #item="{ data: fileData }">
        <div class="h-48 w-full">
          <ShareFilePreview :file="fileData as ShareFileJSON" />
        </div>
      </template>
    </Carousel>
  </div>
</template>
<script setup lang="ts">
import {
  type ShareFileJSON,
  type ShareItemJSON,
  isEncryptedData,
} from "@/pages/admin/share/ShareDef";
import ShareFilePreview from "@/pages/admin/share/ShareFilePreview.vue";
import { useI18n } from "@/composables/useI18n";
import { computed } from "vue";

interface ShareCardProps {
  data: ShareItemJSON;
}

const props = defineProps<ShareCardProps>();
const { t } = useI18n();

/** 是否为加密分享 */
const isEncrypted = computed(() => isEncryptedData(props.data.data));
</script>
