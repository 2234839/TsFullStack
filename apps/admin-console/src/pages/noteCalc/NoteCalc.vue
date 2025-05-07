<template>
  <div class="flex flex-col min-h-screen bg-gray-50">
    <header
      class="flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 text-purple-600">
          <i class="pi pi-calculator text-2xl"></i>
        </div>
        <h1 class="text-xl font-bold text-purple-700">计算笔记本</h1>
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

    <div class="flex-1 p-4 sm:p-6 overflow-auto">
      <div class="w-full grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div class="w-full bg-white rounded-lg shadow-sm">
          <div class="p-3 sm:p-4">
            <div class="flex items-center justify-between mb-2">
              <h2 class="font-medium text-gray-500">编辑区</h2>
              <div class="text-gray-400" @click="isAutoCalculate = !isAutoCalculate">
                <span v-if="isAutoCalculate" class="inline-flex items-center text-green-600">
                  <i class="pi pi-plus mr-1"></i>
                  自动计算已开启
                </span>
                <span v-else class="inline-flex items-center text-gray-500 cursor-pointer">
                  <i class="pi pi-minus mr-1"></i>
                  点击开启自动计算
                </span>
              </div>
            </div>
            <textarea
              ref="textareaRef"
              v-model="content"
              class="w-full h-[calc(100vh-12rem)] p-3 sm:p-4 font-mono border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-gray-900"
              spellcheck="false"
              @keydown.tab.prevent="handleTab"
              placeholder="在此输入计算表达式..."></textarea>
          </div>
        </div>

        <div class="w-full bg-white rounded-lg shadow-sm">
          <div class="p-3 sm:p-4">
            <div class="flex items-center justify-between mb-2">
              <h2 class="font-medium text-gray-500">结果区</h2>
              <div class="flex items-center gap-2">
                <div v-if="isCalculating" class="text-purple-600 animate-pulse">计算中...</div>
                <div v-else-if="lastCalculationTime > 0" class="text-gray-400">
                  上次计算: {{ lastCalculationTime_v }}
                </div>
                <Button
                  v-if="!isAutoCalculate"
                  icon="pi pi-calculator"
                  label="立即计算"
                  size="small"
                  @click="calculateContent"
                  class="p-button-sm" />
              </div>
            </div>
            <div
              class="w-full h-[calc(100vh-12rem)] p-3 sm:p-4 font-mono border border-gray-300 rounded-md overflow-auto bg-gray-50">
              <div
                v-if="calculatedLines.length === 0"
                class="flex items-center justify-center h-full text-gray-400">
                <div class="text-center">
                  <i class="pi pi-info-circle text-2xl mb-2"></i>
                  <p>暂无计算结果</p>
                </div>
              </div>
              <div v-else>
                <div v-for="(line, index) in calculatedLines" :key="index">
                  <component :is="line" />
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
              v-model="show_precision"
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

<script setup lang="tsx">
  import { ref, watch, onMounted, nextTick, computed } from 'vue';
  import { create, all } from 'mathjs';

  // PrimeVue组件
  import Button from 'primevue/button';
  import Dialog from 'primevue/dialog';
  import InputSwitch from 'primevue/inputswitch';
  import InputNumber from 'primevue/inputnumber';
  import type { JSX } from 'vue/jsx-runtime';
  import { exampleContent } from '@/pages/noteCalc/exampleContent';
  import { useDateFormat, useDebounceFn } from '@vueuse/core';
  import { delay } from '@/utils/promise';

  //#region 状态管理
  const content = ref(exampleContent);
  const calculatedLines = ref<JSX.Element[]>([]);
  const textareaRef = ref<HTMLTextAreaElement | null>(null);
  const lastCalculationTime = ref(0);
  const isCalculating = ref(false);
  const isAutoCalculate = ref(true);
  const showSettings = ref(false);
  const precision = ref(64);
  const show_precision = ref(4);

  const lastCalculationTime_v = useDateFormat(lastCalculationTime, 'HH:mm:ss');
  /** 显示精度 */
  //#endregion

  /** 创建mathjs实例并配置 */
  const mathInstance = computed(() => {
    return create(all, {
      number: 'number',
      precision: precision.value,
    });
  });

  /** 格式化结果为可显示的字符串，处理精度问题 */
  const formatResult = (result: any): string => {
    if (result === null || result === undefined) {
      return 'undefined';
    }

    // 处理数字类型，解决浮点数精度问题
    if (typeof result === 'number') {
      try {
        // 检查是否是整数
        if (Number.isInteger(result)) {
          return String(result);
        }

        // 对于小数，使用math.format格式化，避免显示过多小数位
        return mathInstance.value.format(result, {
          precision: show_precision.value,
          notation: 'auto',
        });
      } catch (e) {
        console.error('格式化数字失败:', e);
        return String(result);
      }
    }

    // 处理BigNumber类型
    if (
      result &&
      typeof result === 'object' &&
      result.constructor &&
      result.constructor.name === 'BigNumber'
    ) {
      return result.toString();
    }

    // 处理Unit对象
    if (typeof result === 'object') {
      if (result.hasOwnProperty('unit') || result.hasOwnProperty('value')) {
        try {
          // 如果单位对象包含数值，也需要格式化
          if (typeof result.value === 'number') {
            const formattedValue = mathInstance.value.format(result.value, {
              precision: 15,
              notation: 'auto',
            });
            // 尝试手动构建格式化的单位字符串
            if (result.unit && result.unit.toString) {
              return `${formattedValue} ${result.unit.toString()}`;
            }
          }
          return result.toString();
        } catch (e) {
          console.error('转换Unit对象为字符串失败:', e);
          return JSON.stringify(result);
        }
      }

      // 其他对象类型
      try {
        return JSON.stringify(result);
      } catch (e) {
        return '[复杂对象]';
      }
    }

    // 基本类型直接转换为字符串
    return String(result);
  };

  /** 格式化大数字，添加千位分隔符 */
  const formatLargeNumber = (num: number | string): string => {
    // 如果是字符串，尝试转换为数字
    const numValue = typeof num === 'string' ? Number.parseFloat(num) : num;

    // 如果不是有效数字，返回原始值
    if (isNaN(numValue)) return String(num);

    // 如果是大数字（超过1000），使用千位分隔符格式化
    if (Math.abs(numValue) >= 1000) {
      return numValue.toLocaleString('zh-CN');
    }

    // 否则返回原始数字
    return String(numValue);
  };

  // 转义正则表达式中的特殊字符
  const escapeRegExp = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  /** 使用TSX语法高亮文本 */
  const highlightSyntax = (text: string) => {
    // 将文本分解为不同部分
    const parts: JSX.Element[] = [];
    let lastIndex = 0;

    // 高亮数字
    const numberRegex = /\b\d+\.?\d*\b/g;
    let match;

    // 创建一个临时字符串以保存正则表达式匹配结果
    const tempText = text.toString();

    while ((match = numberRegex.exec(tempText)) !== null) {
      if (match.index > lastIndex) {
        // 添加数字前的文本
        parts.push(<span class="text-gray-950">{tempText.substring(lastIndex, match.index)}</span>);
      }
      // 添加高亮的数字
      parts.push(<span class="text-blue-600 font-medium">{match[0]}</span>);
      lastIndex = match.index + match[0].length;
    }

    // 添加剩余的文本
    if (lastIndex < tempText.length) {
      parts.push(<span class="text-gray-950">{tempText.substring(lastIndex)}</span>);
    }
    // 如果没有匹配到任何内容，返回原始文本
    if (parts.length === 0) {
      return <span>{text}</span>;
    }
    return <span>{parts}</span>;
  };

  // 计算内容
  const calculateContent = async () => {
    if (isCalculating.value) return;

    isCalculating.value = true;
    console.log('开始计算...');
    const startTime = performance.now();

    try {
      const lines = content.value.split('\n');
      const results: JSX.Element[] = [];

      /** 创建一个简单的变量存储和变量映射 */
      const variables: Record<string, any> = {};
      const varMap: Record<string, string> = {};
      let varCounter = 0;

      /** 对变量名进行替换，避免中文变量名对 math.js 的影响 */
      function paserSafeExpression(expression: string) {
        let safeExpression = expression;
        // 按照变量名长度降序排序，避免部分替换问题
        const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length);

        // 替换变量名为安全的变量名
        for (const name of sortedVars) {
          if (variables[name] !== undefined) {
            // 使用空格作为分隔符来确保完整替换
            const pattern = new RegExp(
              `(^|[^\\p{L}\\p{N}_])${escapeRegExp(name)}([^\\p{L}\\p{N}_]|$)`,
              'gu',
            );
            safeExpression = safeExpression.replace(pattern, (_match, p1, p2) => {
              return `${p1}${varMap[name]}${p2}`;
            });
          }
        }
        return safeExpression;
      }
      function getSafeScope() {
        const scope: Record<string, any> = {};
        for (const [name, safeVarName] of Object.entries(varMap)) {
          if (variables[name] !== undefined) {
            scope[safeVarName] = variables[name];
          }
        }
        return scope;
      }
      function evalExpression(expression: string) {
        return mathInstance.value.evaluate(paserSafeExpression(expression), getSafeScope());
      }

      // 第一遍扫描：收集所有变量定义
      lines.forEach((line) => {
        const assignmentMatch = line.match(/^([^=]+)=(.+)$/);
        if (assignmentMatch) {
          const varName = assignmentMatch[1].trim();
          if (!varMap[varName]) {
            // 为每个变量创建一个唯一的安全名称，因为 math.js 不支持中文变量名
            varMap[varName] = `v${varCounter++}`;
          }
        }
      });

      // 处理每一行
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        /** 防止卡死ui */
        if (i % 10 === 0) await delay(1);
        // 处理标题
        if (line.startsWith('# ')) {
          results.push(
            <h1 class="text-xl font-bold mt-4 mb-2 text-gray-900">{line.substring(2)}</h1>,
          );
          continue;
        }
        if (line.startsWith('## ')) {
          results.push(
            <h2 class="text-lg font-semibold mt-3 mb-2 text-gray-900">{line.substring(3)}</h2>,
          );
          continue;
        }
        // 处理空行
        if (line.trim() === '') {
          results.push(<div class="empty-line h-6"> </div>);
          continue;
        }
        // 处理注释
        if (line.startsWith('//')) {
          results.push(<div class="my-1 text-gray-500">{line}</div>);
          continue;
        }
        // 处理变量赋值
        const assignmentMatch = line.match(/^([^=]+)=(.+)$/);

        if (assignmentMatch) {
          const varName = assignmentMatch[1].trim();
          const expression = assignmentMatch[2].trim();

          try {
            // 计算表达式
            const result = evalExpression(expression);

            // 存储变量值
            variables[varName] = result;

            // 格式化结果显示
            const resultDisplay = formatResult(result);

            // 检查是否是简单赋值（直接赋值一个数字）
            const isSimpleAssignment = /^\s*\d+(\.\d+)?\s*$/.test(expression.trim());

            // 为赋值表达式创建特殊的显示
            let resultElement;
            if (isSimpleAssignment) {
              // 如果是简单赋值，显示格式化的数字和变量类型
              const formattedNumber = formatLargeNumber(resultDisplay);
              resultElement = (
                <span class="inline-flex items-center ml-2 gap-2">
                  {formattedNumber !== resultDisplay && (
                    <span
                      class="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium"
                      title={typeof result}>
                      {formattedNumber}
                    </span>
                  )}
                </span>
              );
            } else {
              // 如果是复杂表达式，显示计算结果
              resultElement = (
                <span class="inline-block ml-2 bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded border-l-2 border-blue-500">
                  = {resultDisplay}
                </span>
              );
            }

            results.push(
              <div class="my-1 text-gray-900">
                <div class="flex items-center flex-wrap">
                  <span class="expression">{highlightSyntax(line)}</span>
                  {resultElement}
                </div>
              </div>,
            );
          } catch (e: any) {
            console.error(`计算错误 (${line}):`, e);
            results.push(
              <div class="my-1 text-gray-900">
                <div class="flex items-center flex-wrap">
                  <span class="expression">{highlightSyntax(line)}</span>
                  <span class="inline-block ml-2 bg-red-50 text-red-700 font-medium px-2 py-0.5 rounded border-l-2 border-red-500">
                    = 错误: {String(e)}
                  </span>
                </div>
              </div>,
            );
          }
          continue;
        }

        // 处理单位转换 (如 "距离 to m")
        const unitConvMatch = line.match(/^(.+)\s+to\s+([a-zA-Z]+)$/);
        if (unitConvMatch) {
          const varName = unitConvMatch[1].trim();
          // const targetUnit = unitConvMatch[2].trim();

          if (variables[varName] !== undefined) {
            // 转换单位
            const converted = evalExpression(line);
            const resultDisplay = formatResult(converted);

            results.push(
              <div class="my-1 text-gray-900">
                <div class="flex items-center flex-wrap">
                  <span class="expression">{highlightSyntax(line)}</span>
                  <span class="inline-block ml-2 bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded border-l-2 border-blue-500">
                    = {resultDisplay}
                  </span>
                </div>
              </div>,
            );
          } else {
            const e = new Error(`变量 ${varName} 未定义`);
            console.error(`单位转换错误 (${line}):`, e);
            results.push(
              <div class="my-1 text-gray-900">
                <div class="flex items-center flex-wrap">
                  <span class="expression">{highlightSyntax(line)}</span>
                  <span class="inline-block ml-2 bg-red-50 text-red-700 font-medium px-2 py-0.5 rounded border-l-2 border-red-500">
                    = 错误: 变量<span class="text-red-600">{varName}</span>未定义
                  </span>
                </div>
              </div>,
            );
          }
          continue;
        }

        // 处理普通表达式
        try {
          // 计算表达式
          const result = evalExpression(line);

          // 格式化结果显示
          const resultDisplay = formatResult(result);
          results.push(
            <div class="my-1 text-gray-900">
              <div class="flex items-center flex-wrap">
                <span class="expression">{highlightSyntax(line)}</span>
                <span class="inline-block ml-2 bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded border-l-2 border-blue-500">
                  = {resultDisplay}
                </span>
              </div>
            </div>,
          );
        } catch (e) {
          // 如果不是表达式，就原样返回
          results.push(<div class="my-1 text-gray-900">{line}</div>);
        }
      }

      calculatedLines.value = results;
      lastCalculationTime.value = Date.now();

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
  watch(content, debouncedCalculate);

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
        calculatedLines.value = [];
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

    // 重新计算内容
    calculateContent();

    // 关闭设置面板
    showSettings.value = false;
  };

  // 组件挂载后执行计算
  onMounted(() => {
    // 执行初始计算
    calculateContent();
  });
</script>

<style>
  /* 基础样式 */
  .empty-line {
    height: 1.5em;
    line-height: 1.5;
  }

  /* 动画 */
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
