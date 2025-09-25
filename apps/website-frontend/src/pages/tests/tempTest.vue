<style scoped></style>
<template>
  <!-- <SentenceAnalyzer /> -->
  {{ test }}
</template>
<script setup lang="ts">
  import { useAPI } from '@/api';
  import { useAsyncState } from '@vueuse/core';

  const { API } = useAPI();
  const test = useAsyncState(() => {
    return API.moduleApis.template;
  }, undefined);
</script>
