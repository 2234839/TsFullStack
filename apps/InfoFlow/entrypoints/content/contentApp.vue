<style scoped></style>
<template>
  <div class="fixed bottom-0 z-[999]">
    <div class="bg-red-300">2222</div>
    v: {{ infoFlowConfig }}
    <div @click="run()">runInfoFlowGet</div>

    <div @click="testIdb!.a++">  testIdb:{{ testIdb }}</div>
    <Button>333</Button>
  </div>
</template>
<script setup lang="ts">
  import { infoFlowGetMessenger } from '@/services/InfoFlowGet/messageProtocol';
  import { useIdbTest, useInfoFlowConfig } from '@/storage/config';
  import { Button } from 'primevue';
  const infoFlowConfig = useInfoFlowConfig();
  const testIdb = useIdbTest();
  async function run() {
    const res = await infoFlowGetMessenger.sendMessage('runInfoFlowGet', {
      url: 'https://shenzilong.cn',
    });
    console.log('[res]', res);
  }
</script>
