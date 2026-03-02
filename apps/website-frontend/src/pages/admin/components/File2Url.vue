<template>
  <slot :url="fileUrl" />
</template>
<script setup lang="ts">
  import { useAPI } from '@/api';
  import { authInfo_isLogin } from '@/storage';
  import { ref, watch } from 'vue';

  const { AppAPIGetUrl, APIGetUrl } = useAPI();
  const props = defineProps<{
    fileId: number | string;
  }>();

  const fileUrl = ref('');

  watch(
    () => props.fileId,
    async () => {
      const fileId = typeof props.fileId === 'string' ? Number(props.fileId) : props.fileId;
      if (authInfo_isLogin.value) {
        fileUrl.value = await APIGetUrl.fileApi.file(fileId);
      } else {
        fileUrl.value = await AppAPIGetUrl.fileApi.file(fileId);
      }
    },
    { immediate: true },
  );
</script>
