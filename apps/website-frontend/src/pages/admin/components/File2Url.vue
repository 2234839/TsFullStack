<template>
  <slot :url="fileUrl" :loading="loading" />
</template>
<script setup lang="ts">
  import { useAPI } from '@/api';
  import { authInfo_isLogin } from '@/storage';
  import { ref, watch } from 'vue';

  const { AppAPIGetUrl, APIGetUrl } = useAPI();
  const props = defineProps<{
    fileId: number | string;
  }>();

  const fileUrl = ref('')
  /** URL 正在加载中 */
  const loading = ref(false)

  watch(
    () => props.fileId,
    async () => {
      loading.value = true
      const fileId = typeof props.fileId === 'string' ? Number(props.fileId) : props.fileId;
      try {
        if (authInfo_isLogin.value) {
          fileUrl.value = await APIGetUrl.fileApi.file(fileId);
        } else {
          fileUrl.value = await AppAPIGetUrl.fileApi.file(fileId);
        }
      } finally {
        loading.value = false
      }
    },
    { immediate: true },
  );
</script>
