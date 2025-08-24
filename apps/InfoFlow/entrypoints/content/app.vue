<style scoped></style>
<template>
  <div class="fixed bottom-0">
    <div class="bg-red-300">2222</div>
    v: {{ infoFlowConfig }}
    <Button @click="infoFlowConfig!.test++">1111</Button>
  </div>
</template>
<script setup lang="ts">
  import { infoFlowConfig } from '@/storage/config';
  import Button from './Button.vue';
</script>
