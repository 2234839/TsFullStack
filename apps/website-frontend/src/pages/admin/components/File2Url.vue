<template>
  <slot :url="fileUrl" :loading="loading" />
</template>
<script setup lang="ts">
  import { useAPI } from '@/api';
  import { authInfo_isLogin } from '@/storage';
  import { ref, watch } from 'vue';

  const { AppAPIGetUrl, APIGetUrl } = useAPI();
  const { fileId } = defineProps<{
    fileId: number | string;
  }>();

  const fileUrl = ref('')
  /** URL 正在加载中 */
  const loading = ref(false)

  watch(
    () => fileId,
    async () => {
      loading.value = true
      const fileIdVal = typeof fileId === 'string' ? Number(fileId) : fileId;
      try {
        if (authInfo_isLogin.value) {
          fileUrl.value = await APIGetUrl.fileApi.file(fileIdVal);
        } else {
          fileUrl.value = await AppAPIGetUrl.fileApi.file(fileIdVal);
        }
      } finally {
        loading.value = false
      }
    },
    { immediate: true },
  );
</script>
