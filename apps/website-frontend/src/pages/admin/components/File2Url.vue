<template>
  <slot :url="fileUrl" />
</template>
<script setup lang="ts">
  import { useAPI } from '@/api';
  import { ref, watch, watchEffect } from 'vue';

  const { APIGetUrl } = useAPI();
  const props = defineProps<{
    fileId: number;
  }>();

  const fileUrl = ref('');

  watch(
    () => props.fileId,
    async () => {
      fileUrl.value = await APIGetUrl.fileApi.file(props.fileId);
    },
    { immediate: true },
  );
</script>
