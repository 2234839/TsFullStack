<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-6 md:p-8">
    <div class="max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
      <h1 class="text-3xl font-bold mb-6 text-center text-gray-800 dark:text-white">
        英文句子结构分析器
      </h1>

      <div class="mb-6">
        <label
          for="sentence-input"
          class="block text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">
          输入英文句子：
        </label>
        <textarea
          id="sentence-input"
          v-model="sentence"
          class="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          rows="4"
          placeholder="例如：It is certain that if there are fewer people driving, there will be less air pollution."></textarea>
      </div>

      <button
        @click="analyzeSentence"
        :disabled="isAnalyzing || !sentence.trim()"
        class="w-full px-6 py-3 bg-primary-600 text-white font-semibold rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200">
        {{ isAnalyzing ? '分析中...' : '分析句子' }}
      </button>

      <div
        v-if="error"
        class="mt-6 p-4 bg-danger-100 text-danger-800 rounded-md dark:bg-danger-900 dark:text-danger-200 border border-danger-300 dark:border-danger-700">
        <p class="font-medium">错误：</p>
        <p>{{ error }}</p>
      </div>

      <div
        v-if="analysisResult"
        class="mt-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <h2 class="text-xl font-semibold mb-4 text-gray-800 dark:text-white">分析结果：</h2>
        <!-- 顶层容器也使用 items-end 来对齐所有顶层元素底部 -->
        <div class="flex flex-row items-end gap-x-8 p-4 min-w-max">
          <ClauseOrWordRenderer
            v-for="(item, index) in analysisResult.analysis"
            :key="index"
            :item="item" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="tsx">
  import { ref, computed } from 'vue';
  // 假设 callAiResponseJSON 已经存在并正确导入
  import { callAiResponseJSON } from '@/pages/AiEnglish/ai'; // 保持用户提供的导入路径

  // 辅助函数：合并 Tailwind CSS 类名
  const cn = (...classes: (string | undefined | null | boolean)[]) => {
    return classes.filter(Boolean).join(' ');
  };

  // 定义 AI 输出的类型接口
  interface WordItem {
    type: 'word'; // 明确的判别属性
    text: string;
    role?: string;
    pos?: string;
    className?: string;
    label?: string;
    labelClassName?: string;
  }

  interface ClauseItem {
    type: 'clause'; // 明确的判别属性
    label: string;
    className?: string;
    connector?: WordItem;
    content?: (WordItem | ClauseItem)[];
  }

  interface AnalysisResult {
    analysis: (WordItem | ClauseItem)[];
  }

  // Vue 响应式状态
  const sentence = ref('');
  const isAnalyzing = ref(false);
  const error = ref('');
  const analysisResult = ref<AnalysisResult | null>(null);

  // TSX 子组件：渲染单个词语节点
  const WordNode = (props: WordItem) => {
    return (
      // 确保所有 WordNode 的总高度一致，并底部对齐
      <div class="relative flex flex-col items-center justify-end min-h-[80px]">
        {' '}
        {/* 增加最小高度以容纳 role/pos */}
        {props.label && (
          <span
            class={cn(
              'absolute -top-6 px-2 py-0.5 text-xs rounded-md font-semibold',
              props.labelClassName,
            )}>
            {props.label}
          </span>
        )}
        <div
          class={cn(
            'px-4 py-2 rounded-md shadow-sm text-sm font-medium whitespace-nowrap',
            'border border-gray-200 dark:border-gray-600', // Default border
            props.className,
          )}>
          {props.text}
        </div>
        {(props.role || props.pos) && (
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
            {props.role && <span>{props.role}</span>}
            {props.role && props.pos && <span> / </span>}
            {props.pos && <span>{props.pos}</span>}
          </div>
        )}
      </div>
    );
  };

  // TSX 子组件：渲染从句框或递归渲染词语/从句
  const ClauseOrWordRenderer = (props: { item: WordItem | ClauseItem }) => {
    const item = props.item;

    // 使用类型守卫来判断 item 的类型
    if (item.type === 'clause') {
      const clause = item as ClauseItem; // TypeScript 现在可以安全地将其视为 ClauseItem

      // 判断内容中是否有多个嵌套从句，以决定内部排列方式
      // 确保 clause.content 是数组，即使它是 undefined
      const hasMultipleNestedClauses =
        (clause.content || []).filter((contentItem) => contentItem.type === 'clause').length > 1;

      // 从句框的外部样式，只包含边框和圆角，不包含内边距
      const clauseOuterClasses = cn(
        'relative rounded-lg bg-white dark:bg-gray-700 shadow-md border',
        'flex flex-col items-start', // 保持 flex-col 结构
        clause.className, // 包含 border-2 border-gray-300 等
      );

      // 从句内容容器的内部样式，包含内边距和对齐方式
      const contentContainerClasses = cn(
        'flex items-end gap-x-4 gap-y-8 pt-8 pb-4 px-4', // 调整内边距，pt-8 为标签留出空间
        hasMultipleNestedClauses ? 'flex-col items-start space-y-4' : 'flex-wrap',
      );

      // 根据从句标签设置颜色
      const labelColorClass = computed(() => {
        switch (clause.label) {
          case '主句':
            return 'bg-primary-500 text-white';
          case '主语从句':
            return 'bg-warning-500 text-white';
          case '状语从句':
            return 'bg-warning-500 text-white';
          case '定语从句':
            return 'bg-success-500 text-white'; // 示例颜色
          case '宾语从句':
            return 'bg-purple-500 text-white'; // 示例颜色
          default:
            return 'bg-gray-500 text-white';
        }
      });

      return (
        <div class={clauseOuterClasses}>
          <span
            class={cn(
              'absolute -top-3 left-4 px-3 py-1 text-xs rounded-md font-semibold',
              labelColorClass.value,
            )}>
            {clause.label}
          </span>
          <div class={contentContainerClasses}>
            {clause.connector && (
              <WordNode
                text={clause.connector.text}
                role={clause.connector.role}
                pos={clause.connector.pos}
                className={clause.connector.className}
                type="word" // 明确指定类型
              />
            )}
            {clause.content?.map((contentItem, index) => (
              <ClauseOrWordRenderer key={index} item={contentItem} />
            ))}
          </div>
        </div>
      );
    } else {
      // 如果不是从句，则渲染为词语节点
      return <WordNode {...(item as WordItem)} />;
    }
  };

  // 分析句子的主逻辑
  const analyzeSentence = async () => {
    if (!sentence.value.trim()) {
      error.value = '请输入有效的英文句子。';
      return;
    }

    isAnalyzing.value = true;
    error.value = '';
    analysisResult.value = null;

    const prompt = `
      请分析以下英文句子的语法结构，并以严格的JSON格式返回。
      你的输出必须是一个JSON对象，包含一个名为 "analysis" 的数组。
      数组中的每个元素代表一个从句或一个词语。
      从句对象应包含:
      - "type": "clause"
      - "label": 从句类型 (例如 "主句", "主语从句", "状语从句", "定语从句", "宾语从句")
      - "className": 从句框的 Tailwind CSS 类名 (例如 "border-2 border-gray-300 p-4 rounded-lg", "border-2 border-dashed border-primary-300 p-4 rounded-lg mt-4")
      - "connector": (可选) 如果是从句连接词，包含其 "text", "role", "pos", "className"
      - "content": 包含词语对象或嵌套从句对象的数组

      词语对象应包含:
      - "type": "word"
      - "text": 词语文本
      - "role": 语法角色 (例如 "主语", "谓语", "表语", "定语", "宾语", "形式主语", "助动词", "连接词")
      - "pos": 词性 (例如 "代词", "动词", "形容词", "名词短语", "副词", "动名词", "情态动词", "连词")
      - "className": 词语框的 Tailwind CSS 类名。
        *   对于普通词语（如名词、代词、形容词、副词、介词等），请使用 "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-white"。
        *   对于动词（包括助动词、情态动词、谓语动词等），请使用 "bg-primary-500 text-white"。
        *   对于连接词（如 that, if），请使用 "bg-pink-500 text-white"。
      - "label": (可选) 词语上方的小标签 (例如 "adj", "sth", "定语")
      - "labelClassName": (可选) 小标签的 Tailwind CSS 类名 (例如 "bg-teal-500 text-white", "bg-primary-500 text-white")

      请严格按照以下示例的结构和颜色类名进行输出，不要包含任何额外文本或Markdown格式之外的内容。

      示例输出结构 (仅供参考，请根据实际句子生成):
      {
        "analysis": [
          {
            "type": "clause",
            "label": "主句",
            "className": "border-2 border-gray-300 rounded-lg dark:border-gray-600",
            "content": [
              {"type": "word", "text": "It", "role": "主语", "pos": "代词", "className": "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-white"},
              {"type": "word", "text": "is", "role": "谓语", "pos": "动词", "className": "bg-primary-500 text-white"},
              {"type": "word", "text": "certain", "role": "表语", "pos": "形容词", "className": "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-white", "label": "adj", "labelClassName": "bg-teal-500 text-white"},
              {
                "type": "clause",
                "label": "宾语从句",
                "className": "border-2 border-dashed border-purple-400 rounded-lg dark:border-purple-700",
                "connector": {"type": "word", "text": "that", "role": "连接词", "pos": "连词", "className": "bg-pink-500 text-white"},
                "content": [
                  {"type": "word", "text": "if", "role": "连接词", "pos": "连词", "className": "bg-pink-500 text-white"},
                  {
                    "type": "clause",
                    "label": "状语从句",
                    "className": "border-2 border-dashed border-warning-300 rounded-lg dark:border-warning-700",
                    "connector": {"type": "word", "text": "there", "role": "连接词", "pos": "副词", "className": "bg-pink-500 text-white"},
                    "content": [
                      {"type": "word", "text": "are", "role": "谓语", "pos": "动词", "className": "bg-primary-500 text-white"},
                      {"type": "word", "text": "fewer", "role": "定语", "pos": "形容词", "className": "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-white", "label": "adj", "labelClassName": "bg-teal-500 text-white"},
                      {"type": "word", "text": "people", "role": "主语", "pos": "名词", "className": "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-white", "label": "sth", "labelClassName": "bg-teal-500 text-white"}
                    ]
                  },
                  {
                    "type": "clause",
                    "label": "主句",
                    "className": "border-2 border-dashed border-primary-300 rounded-lg dark:border-primary-700",
                    "content": [
                      {"type": "word", "text": "driving,", "role": "定语", "pos": "动名词", "className": "bg-primary-500 text-white", "label": "定语", "labelClassName": "bg-primary-500 text-white"},
                      {"type": "word", "text": "there", "role": "形式主语", "pos": "副词", "className": "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-white"},
                      {"type": "word", "text": "will", "role": "助动词", "pos": "情态动词", "className": "bg-primary-500 text-white"},
                      {"type": "word", "text": "be", "role": "谓语", "pos": "动词", "className": "bg-primary-500 text-white"},
                      {"type": "word", "text": "less air pollution", "role": "表语", "pos": "名词短语", "className": "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-white", "label": "sth", "labelClassName": "bg-teal-500 text-white"}
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }

      对于句子 "it returns all available items without waiting for more."，请生成如下结构：
      {
        "analysis": [
          {
            "type": "clause",
            "label": "主句",
            "className": "border-2 border-gray-300 rounded-lg dark:border-gray-600",
            "content": [
              {"type": "word", "text": "it", "role": "主语", "pos": "代词", "className": "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-white"},
              {"type": "word", "text": "returns", "role": "谓语", "pos": "动词", "className": "bg-primary-500 text-white"},
              {"type": "word", "text": "all", "role": "限定词", "pos": "形容词", "className": "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-white"},
              {"type": "word", "text": "available", "role": "定语", "pos": "形容词", "className": "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-white"},
              {"type": "word", "text": "items", "role": "宾语", "pos": "名词", "className": "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-white"},
              {"type": "word", "text": "without", "role": "介词", "pos": "介词", "className": "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-white"},
              {"type": "word", "text": "waiting", "role": "宾语", "pos": "动名词", "className": "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-white"},
              {"type": "word", "text": "for", "role": "介词", "pos": "介词", "className": "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-white"},
              {"type": "word", "text": "more", "role": "限定词", "pos": "形容词", "className": "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-white"}
            ]
          }
        ]
      }

      句子: "${sentence.value}"
    `;

    try {
      const response = await callAiResponseJSON(prompt);
      if (response) {
        analysisResult.value = response as any;
      } else {
        error.value = 'AI返回内容为空。';
      }
    } catch (err: any) {
      console.error('分析失败:', err);
      error.value = `分析失败: ${err.message || '未知错误'}`;
    } finally {
      isAnalyzing.value = false;
    }
  };
</script>

<style scoped>
  /* 可以添加一些全局或组件特定的样式，如果 Tailwind 不够用 */
  /* 例如，如果需要更复杂的动画或非 Tailwind 颜色 */
</style>
