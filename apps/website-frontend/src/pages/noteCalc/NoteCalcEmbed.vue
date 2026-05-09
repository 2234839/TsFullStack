<template>
  <div class="note-calc-embed">
    <CodeMirrorEditor v-model="content" :config="embedConfig" hide-toolbar />
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import CodeMirrorEditor from '@/pages/noteCalc/CodeMirrorEditor.vue';
  import type { CalculatorConfig } from './types';

  const content = ref('');

  /** 嵌入模式固定配置，不暴露设置面板 */
  const embedConfig = ref<CalculatorConfig & { isAutoCalculate: boolean }>({
    isAutoCalculate: true,
    precision: 64,
    showPrecision: 4,
  });

  onMounted(() => {
    const hashContent = window.location.hash.slice(1);
    if (hashContent) {
      try {
        content.value = decodeURIComponent(hashContent).replace(/\\n/g, '\n');
      } catch {
        content.value = hashContent.replace(/\\n/g, '\n');
      }
    }
  });
</script>

<style scoped>
  .note-calc-embed {
    width: 100%;
    height: 100vh;
    overflow: hidden;
  }
</style>
