<style scoped></style>
<template>
  <!-- <SentenceAnalyzer /> -->
  <div>test:{{ test.state.value }}</div>
</template>
<script setup lang="ts">
  import { AppAPI } from '@/api';
  // import SentenceAnalyzer from '@/pages/AiEnglish/SentenceAnalyzer.vue';
  import { useAsyncState } from '@vueuse/core';
  const test = useAsyncState(() => AppAPI.moduleApi.template.test(), undefined);
</script>
