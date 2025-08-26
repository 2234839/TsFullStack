<style scoped></style>
<template>
  <div class="fixed bottom-0 z-[999]">
    <div class="bg-red-300">2222</div>
    v: {{ infoFlowConfig }}
    <div @click="run()">runInfoFlowGet</div>
  </div>
</template>
<script setup lang="ts">
  import { infoFlowGetMessenger } from '@/services/InfoFlowGet/messageProtocol';
  import { useInfoFlowConfig } from '@/storage/config';
  const infoFlowConfig = useInfoFlowConfig();
  async function run() {
    const res = await infoFlowGetMessenger.sendMessage('runInfoFlowGet', {
      url: 'https://shenzilong.cn',
    });
    console.log('[res]', res);
  }
</script>
