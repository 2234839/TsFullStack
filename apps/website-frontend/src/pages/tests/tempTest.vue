<style scoped></style>
<template>
  <!-- <SentenceAnalyzer /> -->
  {{ test.state.value }}
</template>
<script setup lang="ts">
  import { useAPI } from '@/api';
  import { useAsyncState } from '@vueuse/core';

  const { API } = useAPI();
  const test = useAsyncState(() => {
    return API.testApi.并发控制();
  }, undefined);
</script>
