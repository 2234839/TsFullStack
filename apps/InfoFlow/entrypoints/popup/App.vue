<style scoped></style>
<template>
  <div class="min-w-10 p-4">
    <div class="bg-red-300">2222</div>
    v: {{ infoFlowConfig }}
    <div @click="infoFlowConfig!.test++">1111</div>
  </div>
</template>
<script setup lang="ts">
  import { infoFlowConfig } from '@/storage/config';
</script>
