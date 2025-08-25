<style scoped></style>
<template>
  <div class="fixed bottom-0 z-[999]">
    <div class="bg-red-300">2222</div>
    v: {{ infoFlowConfig }}
    <div @click="infoFlowConfig!.test++">1111</div>
    <div @click="run()">runInfoFlowGet</div>
  </div>
</template>
<script setup lang="ts">
  import { infoFlowGetMessage } from '@/services/InfoFlowGet/messageProtocol';
  import { infoFlowConfig } from '@/storage/config';

  async function run() {
    const res = await infoFlowGetMessage.sendMessage('runInfoFlowGet', {
      url: 'https://shenzilong.cn',
    });
    console.log('[res]', res);
  }
</script>
