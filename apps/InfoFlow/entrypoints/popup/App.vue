<style scoped></style>
<template>
  <div class="min-w-10 p-4">
    <div class="bg-red-300">2222</div>
    v: {{ infoFlowConfig }}
    <div @click="infoFlowConfig!.test++">1111</div>
    <Button @click="run()">runInfoFlowGet</Button>
  </div>
</template>
<script setup lang="ts">
  import { infoFlowGetMessenger } from '@/services/InfoFlowGet/messageProtocol';
  import { useInfoFlowConfig } from '@/storage/config';
  import { Button } from 'primevue';
  const infoFlowConfig = useInfoFlowConfig();

  async function run() {
    const res = await infoFlowGetMessenger.sendMessage('runInfoFlowGet', {
      url: 'https://shenzilong.cn',
    });
    console.log('[res]', res);
  }
</script>
