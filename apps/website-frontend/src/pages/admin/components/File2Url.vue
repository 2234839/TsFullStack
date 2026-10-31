<template>
  <slot :url="fileUrl" :loading="loading" />
</template>
<script setup lang="ts">
import { resolveFileObjectUrl } from '@/composables/useFileUrl';
import { ref, watch } from 'vue';

const { fileId } = defineProps<{
  fileId: number | string;
}>();

const fileUrl = ref('');
/** URL 正在加载中 */
const loading = ref(false);

watch(
  () => fileId,
  async () => {
    loading.value = true;
    const fileIdVal = typeof fileId === 'string' ? Number(fileId) : fileId;
    try {
      fileUrl.value = await resolveFileObjectUrl(fileIdVal);
    } catch {
      fileUrl.value = '';
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);
</script>
