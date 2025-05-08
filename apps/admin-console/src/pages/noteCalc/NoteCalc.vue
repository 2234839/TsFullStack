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
          @click="handleNewDocument"
          title="新建文档" />
        <Button
          icon="pi pi-cog"
          class="p-button-outlined p-button-rounded"
          @click="showSettings = !showSettings"
          title="设置" />
      </div>
    </header>

    <div class="flex-1 p-4 sm:p-6 overflow-auto dark:bg-gray-900">
      <div class="w-full grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <div class="p-3 sm:p-4">
            <div class="flex items-center justify-between mb-2">
              <h2 class="font-medium text-gray-500 dark:text-gray-400">编辑区</h2>
              <div class="text-gray-400" @click="isAutoCalculate = !isAutoCalculate">
                <span
                  v-if="isAutoCalculate"
                  class="inline-flex items-center text-green-600 dark:text-green-400">
                  <i class="pi pi-plus mr-1"></i>
                  自动计算已开启
                </span>
                <span
                  v-else
                  class="inline-flex items-center text-gray-500 dark:text-gray-400 cursor-pointer">
                  <i class="pi pi-minus mr-1"></i>
                  点击开启自动计算
                </span>
              </div>
            </div>
            <textarea
              ref="textareaRef"
              v-model="content"
              class="w-full h-[calc(100vh-13rem)] p-3 sm:p-4 font-mono border border-gray-300 dark:border-gray-600 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              spellcheck="false"
              @keydown.tab.prevent="handleTab"
              placeholder="在此输入计算表达式..."></textarea>
          </div>
        </div>

        <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <div class="p-3 sm:p-4">
            <div class="flex items-center justify-between mb-2">
              <h2 class="font-medium text-gray-500 dark:text-gray-400">结果区</h2>
              <div class="flex items-center gap-2">
                <div v-if="isCalculating" class="text-purple-600 dark:text-purple-400">
                  计算中...
                </div>
                <div v-else-if="lastCalculationTime > 0" class="text-gray-400 dark:text-gray-500">
                  上次计算: {{ lastCalculationTime_v }}
                </div>
                <Button
                  v-if="!isAutoCalculate"
                  icon="pi pi-calculator"
                  label="立即计算"
                  size="small"
                  @click="calculateContent(true)"
                  class="p-button-sm" />
              </div>
            </div>
            <div
              class="w-full h-[calc(100vh-13rem)] p-3 sm:p-4 font-mono border border-gray-300 dark:border-gray-600 rounded-md overflow-auto bg-gray-50 dark:bg-gray-700">
              <div
                v-if="calculatedResults.length === 0"
                class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                <div class="text-center">
                  <i class="pi pi-info-circle text-2xl mb-2"></i>
                  <p>暂无计算结果</p>
                </div>
              </div>
              <div v-else>
                <div v-for="(result, index) in calculatedResults" :key="index">
                  <!-- 根据结果类型渲染不同的组件 -->
                  <div
                    v-if="result.type === 'title'"
                    class="text-xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">
                    {{ result.content }}
                  </div>

                  <div
                    v-else-if="result.type === 'subtitle'"
                    class="text-lg font-semibold mt-3 mb-2 text-gray-900 dark:text-gray-100">
                    {{ result.content }}
                  </div>

                  <div v-else-if="result.type === 'empty'" class="empty-line h-6"></div>

                  <div
                    v-else-if="result.type === 'comment'"
                    class="my-1 text-gray-500 dark:text-gray-400">
                    {{ result.content }}
                  </div>

                  <div
                    v-else-if="result.type === 'error'"
                    class="my-1 text-gray-900 dark:text-gray-100">
                    <div class="flex items-center flex-wrap">
                      <span class="expression">
                        <span
                          v-for="(part, i) in result.highlightedContent"
                          :key="i"
                          :class="{
                            'text-blue-600 dark:text-blue-400 font-medium': part.isNumber,
                            'text-gray-950 dark:text-gray-100': !part.isNumber,
                          }">
                          {{ part.text }}
                        </span>
                      </span>
                      <span
                        class="inline-block ml-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium px-2 py-0.5 rounded border-l-2 border-red-500 dark:border-red-600">
                        = 错误: {{ result.error }}
                      </span>
                    </div>
                  </div>

                  <div
                    v-else-if="result.type === 'assignment'"
                    class="my-1 text-gray-900 dark:text-gray-100">
                    <div class="flex items-center flex-wrap">
                      <span class="expression">
                        <span
                          v-for="(part, i) in result.highlightedContent"
                          :key="i"
                          :class="{
                            'text-blue-600 dark:text-blue-400 font-medium': part.isNumber,
                            'text-gray-950 dark:text-gray-100': !part.isNumber,
                          }">
                          {{ part.text }}
                        </span>
                      </span>
                      <span class="inline-flex items-center ml-2 gap-2">
                        <span
                          v-if="result.isLargeNumber"
                          class="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                          {{ result.formattedNumber }}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div
                    v-else-if="result.type === 'expression' || result.type === 'unitConversion'"
                    class="my-1 text-gray-900 dark:text-gray-100">
                    <div class="flex items-center flex-wrap">
                      <span class="expression">
                        <span
                          v-for="(part, i) in result.highlightedContent"
                          :key="i"
                          :class="{
                            'text-blue-600 dark:text-blue-400 font-medium': part.isNumber,
                            'text-gray-950 dark:text-gray-100': !part.isNumber,
                          }">
                          {{ part.text }}
                        </span>
                      </span>
                      <span
                        class="inline-block ml-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium px-2 py-0.5 rounded border-l-2 border-blue-500 dark:border-blue-600">
                        = {{ result.result }}
                      </span>
                    </div>
                  </div>

                  <div v-else class="my-1 text-gray-900 dark:text-gray-100">
                    {{ result.content }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 设置面板 -->
    <Dialog v-model:visible="showSettings" header="设置" modal class="w-[30rem]">
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <label class="font-medium">自动计算</label>
          <InputSwitch v-model="isAutoCalculate" />
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

  // PrimeVue组件
  import Button from 'primevue/button';
  import Dialog from 'primevue/dialog';
  import InputSwitch from 'primevue/inputswitch';
  import InputNumber from 'primevue/inputnumber';

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
  const previousContent = ref(''); // 用于存储上一次计算的内容

  const lastCalculationTime_v = useDateFormat(lastCalculationTime, 'HH:mm:ss');
  //#endregion

  // 创建计算器实例
  const calculator = useCalculator({
    precision: precision.value,
    showPrecision: showPrecision.value,
  });

  // 计算内容
  const calculateContent = async (forceFullCalculation = false): Promise<void> => {
    if (isCalculating.value) return;

    isCalculating.value = true;
    console.log('开始计算...');
    const startTime = performance.now();

    try {
      let results: CalculationResult[];

      if (forceFullCalculation || previousContent.value === '') {
        // 首次计算或强制全量计算
        results = await calculator.calculateAll(content.value);
        console.log('执行全量计算');
      } else {
        // 增量计算
        results = await calculator.calculateIncremental(previousContent.value, content.value);
        console.log('执行增量计算');
      }

      // 更新结果和时间
      calculatedResults.value = results;
      lastCalculationTime.value = Date.now();

      // 保存当前内容用于下次比较
      previousContent.value = content.value;

      const endTime = performance.now();
      console.log(`计算耗时: ${endTime - startTime}ms`);
    } finally {
      isCalculating.value = false;
    }
  };

  // 防抖处理的计算函数
  const debouncedCalculate = useDebounceFn(() => {
    if (isAutoCalculate.value) {
      calculateContent();
    }
  }, 50);

  // 监听内容变化，重新计算
  watch(content, debouncedCalculate, { deep: false });

  // 处理Tab键
  const handleTab = (_e: KeyboardEvent) => {
    const textarea = textareaRef.value;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // 在光标位置插入两个空格
    const newContent = content.value.substring(0, start) + '  ' + content.value.substring(end);
    content.value = newContent;

    // 重新设置光标位置
    nextTick(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 2;
    });
  };

  // 处理新建文档
  const handleNewDocument = () => {
    if (content.value.trim() !== '') {
      if (confirm('是否确定新建文档？当前内容将被清空。')) {
        content.value = '';
        calculatedResults.value = [];
        lastCalculationTime.value = 0;
        previousContent.value = '';
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

    // 更新计算器配置
    calculator.updateConfig({
      precision: precision.value,
      showPrecision: showPrecision.value,
    });

    // 重新计算内容
    calculateContent(true);

    // 关闭设置面板
    showSettings.value = false;
  };

  // 组件挂载后执行计算
  onMounted(() => {
    // 执行初始计算
    calculateContent(true);
  });
</script>

<style></style>
