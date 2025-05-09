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
          @click="handleNewDocument($event)"
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

    <NoteCalcCore v-model="content" v-model:config="config" />

    <!-- 设置面板 -->
    <Dialog v-model:visible="showSettings" header="设置" modal class="w-[30rem]">
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <label class="font-medium">自动计算</label>
          <ToggleSwitch v-model="config.isAutoCalculate" />
        </div>
        <div class="flex justify-between items-center">
          <label class="font-medium">结果显示精度</label>
          <div class="flex items-center">
            <InputNumber
              v-model="config.showPrecision"
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
              v-model="config.precision"
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
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { exampleContent } from '@/pages/noteCalc/exampleContent';
  import { useClipboard, useThrottleFn } from '@vueuse/core';
  import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
  import { onMounted, reactive, ref, watch } from 'vue';

  import ThemeToggle from '@/components/system/ThemeToggle.vue';
  import { t } from '@/i18n';
  import NoteCalcCore from '@/pages/noteCalc/NoteCalcCore.vue';
  import { router } from '@/router';
  import { Button, Dialog, InputNumber, ToggleSwitch, useConfirm, useToast } from 'primevue';
  import { useRoute } from 'vue-router';

  const toast = useToast();

  const props = defineProps<{
    /** lz-string 压缩后的内容  */
    c?: string;
  }>();

  //#region 状态管理
  const content = ref(exampleContent);
  const config = reactive({
    isAutoCalculate: true,
    precision: 64,
    showPrecision: 4,
  });
  const showSettings = ref(false);
  //#endregion

  // 更新url参数
  const route = useRoute();
  const throttleUpdateQuery = useThrottleFn(
    () => {
      const compressedContent = compressToEncodedURIComponent(content.value);
      router.replace({ query: { ...route.query, c: compressedContent } });
    },
    1200,
    true,
  );
  watch(
    content,
    () => {
      throttleUpdateQuery();
    },
    { deep: false },
  );

  // 处理新建文档
  const confirm = useConfirm();
  const handleNewDocument = (event: MouseEvent) => {
    if (content.value.trim() === '') return;
    confirm.require({
      target: event.currentTarget! as HTMLElement,
      message: t('是否确定新建文档？当前内容将被清空。'),
      icon: 'pi pi-exclamation-triangle',
      rejectProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: 'Ok',
      },
      accept: () => {
        content.value = '';
      },
      reject: () => {},
    });
  };

  // 处理分享功能
  const { copy, copied } = useClipboard();
  const handleShare = () => {
    try {
      // 使用LZString压缩内容
      const compressedContent = compressToEncodedURIComponent(content.value);

      // 创建带有内容参数的URL
      const shareUrl = `${window.location.origin}${window.location.pathname}?c=${compressedContent}`;

      // 使用useClipboard的copy方法
      copy(shareUrl).then(() => {
        if (copied.value) {
          toast.add({
            severity: 'success',
            summary: '分享成功',
            detail: '分享链接已复制到剪贴板！',
            life: 3000,
          });
        }
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
</script>

<style></style>
