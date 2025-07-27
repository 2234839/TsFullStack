<template>
  <slot :url="fileUrl" />
</template>
<script setup lang="ts">
  import { useAPI } from '@/api';
  import { authInfo, authInfo_isLogin } from '@/storage';
  import { ref, watch, watchEffect } from 'vue';

  const { AppAPIGetUrl, APIGetUrl } = useAPI();
  const props = defineProps<{
    fileId: number;
  }>();

  const fileUrl = ref('');

  watch(
    () => props.fileId,
    async () => {
      if (authInfo_isLogin.value) {
        fileUrl.value = await APIGetUrl.fileApi.file(props.fileId);
      } else {
        fileUrl.value = await AppAPIGetUrl.fileApi.file(props.fileId);
      }
    },
    { immediate: true },
  );
</script>
