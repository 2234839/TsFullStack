<template>
  <div class="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
    <header
      class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 text-purple-600 dark:text-purple-400">
          <i class="pi pi-calculator text-2xl!"></i>
        </div>
        <h1 class="text-xl font-bold text-purple-700 dark:text-purple-400">计算笔记本</h1>
      </div>
      <div class="flex items-center gap-2">
        <Button
          icon="pi pi-file"
          label="新建"
          class="p-button-outlined"
          @click="handleNewDocument()"
          title="新建文档" />
        <Button
          icon="pi pi-share-alt"
          label="分享"
          class="p-button-outlined"
          @click="handleShare()"
          title="分享当前文档" />
        <ThemeToggle />
        <Button
          icon="pi pi-cog"
          class="p-button-outlined p-button-rounded"
          @click="showSettings = !showSettings"
          title="设置" />
      </div>
    </header>

    <NoteCalcCore v-model="content" />

    <!-- 设置面板 -->
    <Dialog v-model:visible="showSettings" header="设置" modal class="w-[30rem]">
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <label class="font-medium">自动计算</label>
          <ToggleSwitch v-model="isAutoCalculate" />
        </div>
        <div class="flex justify-between items-center">
          <label class="font-medium">结果显示精度</label>
          <div class="flex items-center">
            <InputNumber
              v-model="showPrecision"
              :min="1"
              :max="100"
              showButtons
              buttonLayout="horizontal"
              decrementButtonClass="p-button-secondary"
              incrementButtonClass="p-button-secondary" />
            <span class="ml-2 text-gray-500">位</span>
          </div>
        </div>
        <div class="flex justify-between items-center">
          <label class="font-medium">计算精度</label>
          <div class="flex items-center">
            <InputNumber
              v-model="precision"
              :min="1"
              :max="100"
              showButtons
              buttonLayout="horizontal"
              decrementButtonClass="p-button-secondary"
              incrementButtonClass="p-button-secondary" />
            <span class="ml-2 text-gray-500">位</span>
          </div>
        </div>
      </div>
      <template #footer>
        <Button
          label="取消"
          icon="pi pi-times"
          @click="showSettings = false"
          class="p-button-text" />
        <Button label="应用" icon="pi pi-check" @click="applySettings()" autofocus />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, onMounted, nextTick } from 'vue';
  import { useDateFormat, useDebounceFn } from '@vueuse/core';
  import { exampleContent } from '@/pages/noteCalc/exampleContent';
  import { useCalculator } from './useCalculator';
  import type { CalculationResult } from './types';
  import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

  import { Button, Dialog, ToggleSwitch, InputNumber, useToast } from 'primevue';
  import ThemeToggle from '@/components/system/ThemeToggle.vue';
  import { useRoute } from 'vue-router';
  import { router } from '@/router';
  import NoteCalcCore from '@/pages/noteCalc/NoteCalcCore.vue';

  const toast = useToast();

  const props = defineProps<{
    /** lz-string 压缩后的内容  */
    c?: string;
  }>();

  //#region 状态管理
  const content = ref(exampleContent);
  const calculatedResults = ref<CalculationResult[]>([]);
  const textareaRef = ref<HTMLTextAreaElement | null>(null);
  const lastCalculationTime = ref(0);
  const isCalculating = ref(false);
  const isAutoCalculate = ref(true);
  const showSettings = ref(false);
  const precision = ref(64);
  const showPrecision = ref(4);
  const showCalculateButton = ref(!isAutoCalculate.value);
  //#endregion

  // 更新url参数
  const route = useRoute();
  const debouncedUpdateQuery = useDebounceFn(() => {
    const compressedContent = compressToEncodedURIComponent(content.value);
    router.replace({ query: { ...route.query, c: compressedContent } });
  }, 1000);
  watch(
    content,
    () => {
      debouncedUpdateQuery();
    },
    { deep: false },
  );

  // 处理新建文档
  const handleNewDocument = () => {
    if (content.value.trim() !== '') {
      if (confirm('是否确定新建文档？当前内容将被清空。')) {
        content.value = '';
        calculatedResults.value = [];
        lastCalculationTime.value = 0;
      }
    } else {
      content.value = '';
    }
  };

  // 应用设置
  const applySettings = () => {
    // 应用设置逻辑
    if (precision.value < 1) precision.value = 1;
    if (precision.value > 100) precision.value = 100;

    if (showPrecision.value < 1) showPrecision.value = 1;
    if (showPrecision.value > 100) showPrecision.value = 100;

    // 关闭设置面板
    showSettings.value = false;
  };

  // 处理分享功能
  const handleShare = () => {
    try {
      // 使用LZString压缩内容
      const compressedContent = compressToEncodedURIComponent(content.value);

      // 创建带有内容参数的URL
      const shareUrl = `${window.location.origin}${window.location.pathname}?c=${compressedContent}`;

      // 复制URL到剪贴板
      navigator.clipboard.writeText(shareUrl).then(() => {
        // 显示成功消息
        toast.add({
          severity: 'success',
          summary: '分享成功',
          detail: '分享链接已复制到剪贴板！',
          life: 3000,
        });
      });
    } catch (error) {
      console.error('分享失败:', error);
      toast.add({
        severity: 'error',
        summary: '分享失败',
        detail: '生成分享链接时出错，请重试',
        life: 3000,
      });
    }
  };

  // 从URL参数加载内容
  const loadContentFromUrl = () => {
    try {
      const compressedContent = props.c;
      if (!compressedContent) return;
      // 解压内容
      const decompressedContent = decompressFromEncodedURIComponent(compressedContent);

      if (!decompressedContent) return;
      content.value = decompressedContent;
    } catch (error) {
      console.error('从URL加载内容失败:', error);
      toast.add({
        severity: 'error',
        summary: '加载失败',
        detail: '从分享链接加载内容时出错',
        life: 3000,
      });
    }
  };

  // 组件挂载后执行计算
  onMounted(() => {
    // 尝试从URL加载内容
    loadContentFromUrl();
  });

  watch(
    () => isAutoCalculate.value,
    (newValue) => {
      showCalculateButton.value = !newValue;
    },
  );
</script>

<style></style>
