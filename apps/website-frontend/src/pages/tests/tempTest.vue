<style scoped></style>
<template>
  <InputText v-model="b.b" />
  <SentenceAnalyzer />
</template>
<script setup lang="ts">
  import SentenceAnalyzer from '@/pages/AiEnglish/SentenceAnalyzer.vue';
  import { useApiStorage } from '@/utils/hooks/UseApiStorage';
  import { InputText } from 'primevue';
  const b = useApiStorage('test1', {b:'333'});
</script>
