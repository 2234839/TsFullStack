<script setup lang="tsx">
  import {
    analyzeArticleWithAI,
    translateParagraphWithAI,
    translateWithAI,
    useCreateMixedTranslation,
    type AIAnalysis,
  } from '@/pages/AiEnglish/ai';
  import { useAiEnglishData } from '@/pages/AiEnglish/data';
  import { speakText } from '@/pages/AiEnglish/util';
  import { useToast } from 'primevue/usetoast';
  import { computed, nextTick, reactive, ref, watch } from 'vue';

  interface StudySession {
    clickedWords: Set<string>;
    startTime: number;
  }

  interface ParagraphTranslation {
    originalText: string;
    translatedText: string;
    mixedTranslation: string;
    wordsInSelection: string[];
  }

  interface SelectionState {
    isSelecting: boolean;
    startWordIndex: number;
    endWordIndex: number;
    selectedWords: Set<number>;
  }

  interface ParagraphData {
    id: number;
    text: string;
    words: string[];
    isCompleted: boolean;
    completedAt?: number;
  }

  // 示例文章
  const sampleArticle = `I like to play with my friends. We run and jump in the park. The sun is bright and the sky is blue.

My dog is happy. He wags his tail when he sees me. We play fetch with a ball.

I eat an apple every day. Apples are good for you. They make you strong and healthy.

My mom reads me a story at night. I like the stories about animals. Then I go to sleep.`;

  // 响应式状态
  const article = ref('');
  const { words, getWordData, updateWordDatas, getWordsData } = useAiEnglishData();
  const selectedWordKey = ref<string>();
  const selectedWord = computed(() => {
    if (!selectedWordKey.value) return undefined;
    return getWordData(selectedWordKey.value);
  });
  const paragraphTranslation = ref<ParagraphTranslation | null>(null);
  const showTranslation = ref(false);
  const translationType = ref<'word' | 'paragraph'>('word');
  const currentSession = reactive<StudySession>({
    clickedWords: new Set(),
    startTime: Date.now(),
  });
  const isStudying = ref(false);
  const isTranslating = ref(false);
  const aiAnalysis = ref<AIAnalysis | null>(null);
  const isAnalyzing = ref(false);
  const showAiAnalysis = ref(false);
  const selectionState = reactive<SelectionState>({
    isSelecting: false,
    startWordIndex: -1,
    endWordIndex: -1,
    selectedWords: new Set(),
  });
  const wordElements = ref<{ word: string; element: HTMLElement; index: number }[]>([]);
  const highlightedWord = ref('');
  const paragraphs = ref<ParagraphData[]>([]);
  const currentParagraphIndex = ref(0);
  const isParagraphMode = ref(false);
  const toast = useToast();

  // 计算属性
  const stats = computed(() => {
    const total = words.value.length;
    const mastered = words.value.filter((w) => w.memoryLevel >= 8).length;
    const familiar = words.value.filter((w) => w.memoryLevel >= 6 && w.memoryLevel < 8).length;
    const learning = words.value.filter((w) => w.memoryLevel >= 3 && w.memoryLevel < 6).length;
    const unknown = words.value.filter((w) => w.memoryLevel < 3).length;
    const averageLevel =
      total > 0
        ? parseFloat((words.value.reduce((sum, w) => sum + w.memoryLevel, 0) / total).toFixed(1))
        : 0;
    const clickedInSession = currentSession.clickedWords.size;
    const notClickedInSession = total - clickedInSession;

    return {
      total,
      mastered,
      familiar,
      learning,
      unknown,
      averageLevel,
      clickedInSession,
      notClickedInSession,
    };
  });

  const currentText = computed(() => {
    if (isParagraphMode.value && paragraphs.value.length > 0) {
      return paragraphs.value[currentParagraphIndex.value]?.text || '';
    }
    return article.value;
  });

  const completedParagraphs = computed(() => paragraphs.value.filter((p) => p.isCompleted).length);

  // 颜色辅助函数
  const getMemoryColor = (level: number): string => {
    const normalizedLevel = Math.max(0, Math.min(10, level));
    const ratio = normalizedLevel / 10;

    if (ratio < 0.5) {
      return `rgb(255, ${Math.round(255 * (ratio * 2))}, 0)`;
    } else {
      return `rgb(${Math.round(255 * (2 - ratio * 2))}, 255, 0)`;
    }
  };

  const getDifficultyColor = (difficulty: number): string => {
    if (difficulty <= 3) return 'text-green-600';
    if (difficulty <= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  // 文本处理
  const tokenizeText = (text: string): string[] => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 0);
  };

  const splitArticleIntoParagraphs = (text: string): ParagraphData[] => {
    const paragraphTexts = text
      .split(/\n\s*\n|\. {2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => (p.endsWith('.') ? p : p + '.'));

    return paragraphTexts.map((text, index) => ({
      id: index,
      text,
      words: tokenizeText(text),
      isCompleted: false,
    }));
  };

  // 核心功能
  const initializeWords = async (text: string, useParagraphMode = false) => {
    const tokens = tokenizeText(text);
    await getWordsData(tokens);

    isStudying.value = true;
    isParagraphMode.value = useParagraphMode;
    currentSession.clickedWords = new Set();
    currentSession.startTime = Date.now();

    // 处理段落模式
    if (useParagraphMode) {
      paragraphs.value = splitArticleIntoParagraphs(text);
      currentParagraphIndex.value = 0;
    }

    // AI分析
    isAnalyzing.value = true;
    aiAnalysis.value = await analyzeArticleWithAI(text);
    isAnalyzing.value = false;

    toast.add({
      severity: 'success',
      summary: '开始学习',
      detail: useParagraphMode
        ? `已分割为 ${paragraphs.value.length} 个段落，开始第一段学习！`
        : `已加载 ${words.value.length} 个词汇，AI分析完成！`,
      life: 3000,
    });
  };

  const handleArticleSubmit = (useParagraphMode = false) => {
    if (article.value.trim()) initializeWords(article.value, useParagraphMode);
  };

  const loadSampleArticle = (useParagraphMode = false) => {
    article.value = sampleArticle;
    initializeWords(sampleArticle, useParagraphMode);
  };

  const getWordIndexFromPoint = (x: number, y: number): number => {
    const element = document.elementFromPoint(x, y);
    if (!element) return -1;

    const wordElement = element.closest('[data-word-index]');
    return wordElement ? parseInt(wordElement.getAttribute('data-word-index') || '-1') : -1;
  };

  const updateSelection = (startIndex: number, endIndex: number) => {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    const selectedWords = new Set<number>();

    for (let i = start; i <= end; i++) selectedWords.add(i);

    selectionState.startWordIndex = startIndex;
    selectionState.endWordIndex = endIndex;
    selectionState.selectedWords = selectedWords;
  };

  const handleMouseDown = (e: MouseEvent, wordIndex: number) => {
    if (!isStudying.value) return;
    e.preventDefault();

    selectionState.isSelecting = true;
    selectionState.startWordIndex = wordIndex;
    selectionState.endWordIndex = wordIndex;
    selectionState.selectedWords = new Set([wordIndex]);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!selectionState.isSelecting || !isStudying.value) return;

    const wordIndex = getWordIndexFromPoint(e.clientX, e.clientY);
    if (wordIndex !== -1 && wordIndex !== selectionState.endWordIndex) {
      updateSelection(selectionState.startWordIndex, wordIndex);
    }
  };

  const handleMouseUp = async () => {
    if (!selectionState.isSelecting || !isStudying.value) return;

    const selectedWordIndices = [...selectionState.selectedWords].sort((a, b) => a - b);
    selectionState.isSelecting = false;
    selectionState.startWordIndex = -1;
    selectionState.endWordIndex = -1;

    if (selectedWordIndices.length === 0) return;

    // 获取选中的单词
    const selectedWordsData = selectedWordIndices
      .map((index) => wordElements.value[index]?.word)
      .filter(Boolean) as string[];

    if (selectedWordsData.length === 1) {
      selectionState.selectedWords = new Set();
    } else if (selectedWordsData.length > 1) {
      await handleParagraphSelection(selectedWordsData);
    }
  };

  const createMixedTranslation = useCreateMixedTranslation({ getWordData });

  const handleParagraphSelection = async (selectedWordsKey: string[]) => {
    highlightedWord.value = '';
    const newClickedWords = new Set(currentSession.clickedWords);

    selectedWordsKey.forEach((word) => newClickedWords.add(word.toLowerCase()));
    currentSession.clickedWords = newClickedWords;

    // 获取段落翻译
    const selectedText = selectedWordsKey.join(' ');
    isTranslating.value = true;
    translationType.value = 'paragraph';
    showTranslation.value = true;
    selectedWordKey.value = undefined;

    try {
      const translatedText = await translateParagraphWithAI(selectedText);
      const mixedTranslation = await createMixedTranslation(
        selectedText,
        translatedText,
        selectedWordsKey,
      );

      paragraphTranslation.value = {
        originalText: selectedText,
        translatedText,
        mixedTranslation,
        wordsInSelection: selectedWordsKey,
      };
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: '翻译失败',
        detail: '段落翻译服务暂时不可用',
        life: 3000,
      });
    } finally {
      isTranslating.value = false;
    }

    speakText(selectedText);
  };

  const handleWordClick = async (word: string) => {
    // 清除状态
    selectionState.isSelecting = false;
    selectionState.selectedWords = new Set();
    highlightedWord.value = '';

    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    highlightedWord.value = cleanWord;

    const wordData = getWordData(word);
    if (!wordData) return;

    // 更新会话
    currentSession.clickedWords.add(cleanWord);

    // 更新单词数据
    const newMemoryLevel = Math.max(0, wordData.memoryLevel - 1);
    selectedWordKey.value = word;
    showTranslation.value = true;
    translationType.value = 'word';
    paragraphTranslation.value = null;

    // 获取AI翻译（如果缺失）
    if (!wordData.aiTranslation) {
      isTranslating.value = true;
      const aiResult = await translateWithAI(word, currentText.value);
      console.log('[aiResult]', aiResult);
      const oldWordData = words.value.find((el) => el.word === word.toLowerCase());
      if (oldWordData) {
        updateWordDatas([
          {
            ...oldWordData,
            memoryLevel: newMemoryLevel,
            clickCount: oldWordData.clickCount + 1,
            lastClickTime: new Date(),
            aiTranslation: aiResult.translation,
            difficulty: aiResult.difficulty,
            examples: aiResult.examples,
            grammar: aiResult.grammar,
            pronunciation: aiResult.pronunciation,
          },
        ]);
      }

      isTranslating.value = false;
    } else {
      const oldWordData = words.value.find((el) => el.word === word.toLowerCase());
      if (oldWordData) {
        updateWordDatas([
          {
            ...oldWordData,
            memoryLevel: newMemoryLevel,
            clickCount: oldWordData.clickCount + 1,
            lastClickTime: new Date(),
          },
        ]);
      }
    }

    speakText(word);
    console.log(`查看翻译 ${word} 熟练度 -1 (当前: ${newMemoryLevel}/10)`);
  };

  const handleParagraphComplete = () => {
    if (!isStudying.value || !isParagraphMode.value) return;

    const currentParagraph = paragraphs.value[currentParagraphIndex.value];
    if (!currentParagraph) return;

    let improvedCount = 0;
    /** 当前片段内的单词，如果未被点击（划选），则熟练度 +1  */
    const updatedWords = words.value
      .map((word) => {
        if (currentParagraph.words.includes(word.word)) {
          if (!currentSession.clickedWords.has(word.word)) {
            improvedCount++;
            return { ...word, memoryLevel: Math.min(10, word.memoryLevel + 1) };
          }
        }
        return undefined;
      })
      .filter((word) => word !== undefined);

    updateWordDatas(updatedWords);
    // 标记段落完成
    paragraphs.value = paragraphs.value.map((p, index) =>
      index === currentParagraphIndex.value ? { ...p, isCompleted: true } : p,
    );
    currentParagraphIndex.value += 1;
    // 重置会话
    currentSession.clickedWords = new Set();
    showTranslation.value = false;
    highlightedWord.value = '';
    selectionState.selectedWords = new Set();

    toast.add({
      severity: 'success',
      summary: '段落学习完成！',
      detail: `第${currentParagraphIndex.value + 1}段完成！${improvedCount} 个单词熟练度提升了 +1`,
      life: 4000,
    });
  };

  const goToParagraph = (index: number) => {
    if (index >= 0 && index < paragraphs.value.length) {
      currentParagraphIndex.value = index;
      currentSession.clickedWords = new Set();
      showTranslation.value = false;
      selectionState.selectedWords = new Set();
    }
  };

  const adjustMemoryLevel = (word: string, newLevel: number) => {
    const updates = words.value.map((w) => (w.word === word ? { ...w, memoryLevel: newLevel } : w));
    updateWordDatas(updates);

    if (selectedWord.value?.word === word) {
      selectedWord.value.memoryLevel = newLevel;
    }
  };

  // 渲染带标记的文章
  function renderArticleWithMarkers() {
    if (!currentText.value) return null;

    const tokens = currentText.value.split(/(\s+|[^\w\s])/);
    let wordIndex = 0;
    return tokens.map((token, tokenIndex) => {
      const cleanWord = token.toLowerCase().replace(/[^\w]/g, '');
      const wordData = getWordData(cleanWord);

      if (wordData && /^\w+$/.test(cleanWord)) {
        const currentWordIndex = wordIndex++;
        const color = getMemoryColor(wordData.memoryLevel);
        const isClicked = currentSession.clickedWords.has(cleanWord);
        const isKeyWord = aiAnalysis.value?.keyWords.includes(cleanWord);
        const isSelected = selectionState.selectedWords.has(currentWordIndex);
        const isHighlighted = highlightedWord.value === cleanWord;

        let className = `cursor-pointer transition-colors duration-200 rounded relative group select-none inline-block px-1 py-0`;
        if (isHighlighted)
          className += ` bg-yellow-400 font-bold text-black custom-highlight-pulse word-highlight`;
        else if (isSelected) className += ` bg-blue-100 font-medium text-gray-800 word-selected`;
        else if (isClicked) className += ` bg-blue-50/40`;
        if (isKeyWord) className += ` font-medium`;

        const titleText = `${cleanWord}: ${wordData.memoryLevel}/10 ${
          isClicked ? '(已操作)' : ''
        } ${isKeyWord ? '(关键词)' : ''} ${isHighlighted ? '(当前选中)' : ''}`;

        return (
          <span
            key={tokenIndex}
            data-word-index={currentWordIndex}
            class={className}
            style={{
              borderBottom: `1px solid ${color}`,
              lineHeight: '1.5',
              display: 'inline-block',
            }}
            onMousedown={(e) => handleMouseDown(e, currentWordIndex)}
            onClick={() => !selectionState.isSelecting && handleWordClick(cleanWord)}
            title={titleText}>
            {token}
            {wordData.memoryLevel > 0 && (
              <span
                class="absolute -bottom-3 left-1/2 transform -translate-x-1/2 text-[9px] opacity-40 group-hover:opacity-80 pointer-events-none"
                style={{ color }}></span>
            )}
            {isKeyWord && (
              <span class="absolute -top-1 -right-1 text-xs opacity-70 pointer-events-none">
                ⭐
              </span>
            )}
          </span>
        );
      }

      return (
        <span key={tokenIndex} class="select-none">
          {token}
        </span>
      );
    });
  }
  // 更新单词元素引用
  watch([currentText, words, currentParagraphIndex], () => {
    nextTick(() => {
      const articleContainer = document.getElementById('article-container');
      if (articleContainer) {
        const elements = Array.from(articleContainer.querySelectorAll('[data-word-index]'));
        wordElements.value = elements.map((element, index) => ({
          word: element.textContent?.toLowerCase().replace(/[^\w]/g, '') || '',
          element: element as HTMLElement,
          index,
        }));
      }
    });
  });

  watch(aiAnalysis, (val) => val && (showAiAnalysis.value = true));
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- 标题 -->
      <div class="text-center space-y-2">
        <h1 class="text-4xl font-bold text-gray-800 flex items-center justify-center gap-3">
          <i class="pi pi-book text-blue-600 text-3xl" />
          AI智能英语学习助手
        </h1>
        <p class="text-gray-600">AI驱动翻译 • 智能难度分析 • 支持分段学习 • 拖拽选择段落翻译</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 左侧：文章输入和显示 -->
        <div class="lg:col-span-2 space-y-4">
          <!-- 文章输入 -->
          <Card>
            <template #title>
              <div class="flex items-center gap-2">
                <i class="pi pi-book" />
                文章输入
                <Tag v-if="isStudying" severity="info" class="ml-auto">
                  {{
                    isParagraphMode
                      ? `段落模式 (${currentParagraphIndex + 1}/${paragraphs.length})`
                      : '学习中...'
                  }}
                </Tag>
              </div>
            </template>
            <template #content>
              <div class="space-y-4">
                <Textarea
                  placeholder="请输入你想学习的英文文章..."
                  v-model="article"
                  class="min-h-[120px] text-base w-full"
                  :disabled="isStudying"
                  autoResize />
                <div class="flex gap-2 flex-wrap">
                  <Button
                    @click="handleArticleSubmit(false)"
                    class="flex-1"
                    :disabled="isStudying || isAnalyzing"
                    :label="isAnalyzing ? 'AI分析中...' : '整篇学习'" />
                  <Button
                    @click="handleArticleSubmit(true)"
                    class="flex-1"
                    :disabled="isStudying || isAnalyzing"
                    severity="secondary"
                    :label="isAnalyzing ? 'AI分析中...' : '分段学习'" />
                  <Button
                    severity="secondary"
                    @click="loadSampleArticle(false)"
                    :disabled="isStudying || isAnalyzing"
                    label="示例整篇" />
                  <Button
                    severity="secondary"
                    @click="loadSampleArticle(true)"
                    :disabled="isStudying || isAnalyzing"
                    label="示例分段" />
                </div>
              </div>
            </template>
          </Card>

          <!-- 文章显示 -->
          <Card v-if="words.length > 0">
            <template #title>
              <!-- 显示段落进度和操作按钮 -->
              <div class="flex items-center gap-2">
                <i class="pi pi-book" style="font-size: 1.25rem" />
                <span class="text-sm text-indigo-600" title="段落进度">
                  {{ completedParagraphs }}/{{ paragraphs.length }} 已完成
                </span>

                <Button
                  severity="secondary"
                  size="small"
                  @click="goToParagraph(currentParagraphIndex - 1)"
                  :disabled="currentParagraphIndex === 0"
                  icon="pi pi-angle-left"
                  v-tooltip.top="'上一段'" />
                <div class="flex-1 flex gap-1 overflow-x-auto">
                  <Button
                    v-for="(_, index) in paragraphs"
                    :key="index"
                    :severity="index === currentParagraphIndex ? 'primary' : 'secondary'"
                    size="small"
                    :class="[
                      'flex-1',
                      { 'bg-green-100 border-green-300': paragraphs[index].isCompleted },
                    ]"
                    @click="goToParagraph(index)"
                    :label="String(index + 1)"
                    :icon="paragraphs[index].isCompleted ? 'pi pi-check-circle' : ''" />
                </div>
                <Button
                  @click="handleParagraphComplete"
                  size="small"
                  icon="pi pi-check"
                  class="bg-blue-600 hover:bg-blue-700 text-white"
                  :disabled="paragraphs[currentParagraphIndex]?.isCompleted"
                  label="OK" />
              </div>
            </template>
            <template #content>
              <div class="mb-4 p-3 bg-blue-50 rounded-lg">
                <div class="flex flex-col sm:flex-row items-center gap-2 text-sm text-blue-700">
                  <span class="font-medium">
                    <i class="pi pi-pencil" style="font-size: 1rem" />使用提示：</span
                  >
                  <span>
                    点击单词查看详细翻译，或拖拽选择多个单词获取段落翻译，下方英文学习完毕后点击右上角的OK按钮
                  </span>
                </div>
              </div>
              <div
                id="article-container"
                class="text-lg leading-relaxed text-gray-800"
                @mousemove="handleMouseMove"
                @mouseup="handleMouseUp"
                @mouseleave="handleMouseUp"
                style="user-select: none">
                <renderArticleWithMarkers />
              </div>
            </template>
          </Card>
          <!-- 翻译面板 -->
          <Card>
            <template #title>
              <div class="flex items-center gap-2">
                <i class="pi pi-sparkles text-purple-600" style="font-size: 1.25rem" />
                AI智能翻译
                <Button
                  v-if="selectedWord || paragraphTranslation"
                  text
                  rounded
                  @click="
                    translationType === 'word'
                      ? speakText(selectedWord?.word || '')
                      : speakText(paragraphTranslation?.originalText || '')
                  "
                  class="ml-auto">
                  <i class="pi pi-volume-up" style="font-size: 1rem" />
                </Button>
              </div>
            </template>
            <template #content>
              <!-- 设置最小高度，减少翻译结果变化导致的跳动 -->
              <div class="space-y-4 min-h-[50rem]">
                <div v-if="showTranslation">
                  <div v-if="translationType === 'word' && selectedWord">
                    <!-- 单词翻译内容 -->
                    <div class="text-2xl font-bold text-blue-600">{{ selectedWord.word }}</div>

                    <div v-if="selectedWord.pronunciation" class="text-lg text-gray-600">
                      <span class="text-sm text-gray-500">音标: </span>
                      {{ selectedWord.pronunciation }}
                    </div>

                    <div class="space-y-3">
                      <div class="flex items-center gap-2">
                        <i class="pi pi-brain" style="font-size: 1rem" />
                        <span class="text-sm text-gray-500">熟练度</span>
                        <Tag
                          :value="`${selectedWord.memoryLevel}/10`"
                          :style="{
                            backgroundColor: getMemoryColor(selectedWord.memoryLevel),
                            color: selectedWord.memoryLevel > 5 ? 'black' : 'white',
                            border: 'none',
                          }" />
                        <span v-if="selectedWord.difficulty" class="text-sm text-gray-500"
                          >难度</span
                        >
                        <Tag
                          v-if="selectedWord.difficulty"
                          :class="getDifficultyColor(selectedWord.difficulty)"
                          :value="`${selectedWord.difficulty}/10`" />
                      </div>

                      <Slider
                        v-model="selectedWord.memoryLevel"
                        @change="adjustMemoryLevel(selectedWord.word, $event)"
                        :min="0"
                        :max="10"
                        :step="1"
                        class="w-full" />
                    </div>

                    <div class="space-y-2 mt-2">
                      <div v-if="isTranslating" class="flex items-center gap-2 text-gray-500">
                        <i class="pi pi-refresh animate-spin" style="font-size: 1rem" />
                        AI翻译中...
                      </div>
                      <div v-else class="text-lg">
                        {{ selectedWord.aiTranslation || '获取翻译中...' }}
                      </div>
                    </div>

                    <div v-if="selectedWord.grammar" class="space-y-2">
                      <div class="text-sm text-gray-500">语法信息</div>
                      <div class="text-sm bg-gray-50 p-2 rounded">{{ selectedWord.grammar }}</div>
                    </div>

                    <div v-if="selectedWord.examples?.length" class="space-y-2">
                      <div class="text-sm text-gray-500">AI例句</div>
                      <div class="space-y-1">
                        <div
                          v-for="(example, index) in selectedWord.examples"
                          :key="index"
                          class="text-sm bg-blue-50 p-2 rounded italic">
                          {{ example }}
                        </div>
                      </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div class="text-gray-500">查看次数</div>
                        <div class="font-medium">{{ selectedWord.clickCount }} 次</div>
                      </div>
                    </div>
                  </div>

                  <div v-else-if="paragraphTranslation">
                    <!-- 段落翻译内容 -->
                    <div class="space-y-3">
                      <div class="space-y-2">
                        <div v-if="isTranslating" class="flex items-center gap-2 text-gray-500">
                          <i
                            class="pi pi-refresh"
                            style="font-size: 1rem; animation: spin 1s linear infinite" />
                          AI翻译中...
                        </div>
                        <div v-else class="p-3 bg-blue-50 rounded-lg">
                          <div class="leading-relaxed">
                            {{ paragraphTranslation.mixedTranslation }}
                          </div>
                          <div class="text-xs text-blue-600 mt-2">
                            💡 熟悉的单词保持英文显示，帮助巩固记忆
                          </div>
                        </div>
                      </div>

                      <div class="space-y-2">
                        <div class="text-sm text-gray-500">完整中文翻译</div>
                        <div class="p-3 bg-green-50 rounded-lg">
                          <div class="text-base leading-relaxed">
                            {{ paragraphTranslation.translatedText }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="text-center py-8 text-gray-500">
                  <i class="pi pi-sparkles w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p class="text-lg font-medium mb-2">点击单词或拖拽选择段落</p>
                  <p class="text-sm">获取AI智能翻译和详细分析</p>
                  <div v-if="isStudying" class="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p class="text-sm text-blue-600">
                      💡 提示：点击单词查看翻译会降低熟练度，{{
                        isParagraphMode ? '完成段落' : '学习完毕'
                      }}时未操作的单词会提升熟练度(+1)
                    </p>
                  </div>
                </div>
              </div>
            </template>
          </Card>
        </div>

        <!-- 右侧：翻译和统计 -->
        <div class="space-y-4 sticky top-4 h-fit max-h-[calc(100vh-2rem)] overflow-y-auto">
          <!-- AI分析结果 -->
          <Card v-if="aiAnalysis" class="border-purple-200 bg-purple-50">
            <template #title>
              <div
                class="flex items-center gap-2 cursor-pointer"
                @click="showAiAnalysis = !showAiAnalysis">
                <i class="pi pi-star-fill" style="font-size: 1.25rem; color: #9333ea" />
                AI智能分析
                <span class="ml-auto text-sm text-purple-600">{{
                  showAiAnalysis ? '收起' : '展开'
                }}</span>
              </div>
            </template>
            <template v-if="showAiAnalysis" #content>
              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-bullseye text-purple-600" style="font-size: 1rem" />
                    <span class="text-sm">文章难度:</span>
                    <Tag
                      :class="getDifficultyColor(aiAnalysis.articleDifficulty)"
                      :value="`${aiAnalysis.articleDifficulty}/10`" />
                  </div>
                  <div class="flex items-center gap-2">
                    <i class="pi pi-brain" style="color: #9333ea; font-size: 1rem" />
                    <span class="text-sm">建议学习时间:</span>
                    <Tag :value="`${aiAnalysis.suggestedStudyTime}分钟`" />
                  </div>
                </div>

                <div v-if="aiAnalysis.keyWords.length > 0">
                  <div class="text-sm text-gray-600 mb-2">关键词汇 ⭐:</div>
                  <div class="flex flex-wrap gap-1">
                    <Tag
                      v-for="(word, index) in aiAnalysis.keyWords"
                      :key="index"
                      severity="info"
                      class="text-xs">
                      {{ word }}
                    </Tag>
                  </div>
                </div>

                <div v-if="aiAnalysis.learningTips.length > 0">
                  <div class="text-sm text-gray-600 mb-2 flex items-center gap-1">
                    <i class="pi pi-lightbulb" style="font-size: 1rem" />
                    学习建议:
                  </div>
                  <ul class="text-sm space-y-1">
                    <li
                      v-for="(tip, index) in aiAnalysis.learningTips"
                      :key="index"
                      class="flex items-start gap-2">
                      <span class="text-purple-600">•</span>
                      <span>{{ tip }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </template>
          </Card>
          <!-- 学习统计 -->
          <Card v-if="words.length > 0">
            <template #title>
              <div class="flex items-center gap-2">
                <i class="pi pi-chart-bar" style="font-size: 1.25rem" />
                学习统计
              </div>
            </template>
            <template #content>
              <div class="space-y-4">
                <div class="text-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                  <div class="text-3xl font-bold text-blue-600">{{ stats.averageLevel }}</div>
                  <div class="text-sm text-gray-500">平均熟练度</div>
                </div>

                <div class="space-y-3">
                  <div class="flex justify-between items-center">
                    <span class="text-sm">总词汇量</span>
                    <Tag :value="stats.total.toString()" severity="info" />
                  </div>

                  <div class="space-y-2">
                    <div class="flex justify-between text-sm">
                      <span>完全掌握 (8-10)</span>
                      <span>{{ stats.mastered }}</span>
                    </div>
                    <ProgressBar
                      :value="Math.round((stats.mastered / stats.total) * 100)"
                      class="h-2" />
                  </div>

                  <div class="space-y-2">
                    <div class="flex justify-between text-sm">
                      <span>比较熟悉 (6-7)</span>
                      <span>{{ stats.familiar }}</span>
                    </div>
                    <ProgressBar
                      :value="Math.round((stats.familiar / stats.total) * 100)"
                      class="h-2"
                      style="background-color: rgb(250, 204, 21)" />
                  </div>

                  <div class="space-y-2">
                    <div class="flex justify-between text-sm">
                      <span>学习中 (3-5)</span>
                      <span>{{ stats.learning }}</span>
                    </div>
                    <ProgressBar
                      :value="Math.round((stats.learning / stats.total) * 100)"
                      class="h-2"
                      style="background-color: rgb(251, 146, 60)" />
                  </div>

                  <div class="space-y-2">
                    <div class="flex justify-between text-sm">
                      <span>需加强 (0-2)</span>
                      <span>{{ stats.unknown }}</span>
                    </div>
                    <ProgressBar
                      :value="Math.round((stats.unknown / stats.total) * 100)"
                      class="h-2"
                      style="background-color: rgb(239, 68, 68)" />
                  </div>
                </div>

                <div class="pt-2 border-t">
                  <div class="text-center">
                    <div class="text-2xl font-bold text-green-600">
                      {{ Math.round(((stats.mastered + stats.familiar) / stats.total) * 100) }}%
                    </div>
                    <div class="text-sm text-gray-500">掌握率</div>
                  </div>
                </div>
              </div>
            </template>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .custom-highlight-pulse {
    animation: custom-pulse 2s infinite;
  }

  .word-highlight::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    background: rgba(245, 158, 11, 0.3);
    border-radius: 4px;
    z-index: -1;
  }

  .word-selected::before {
    content: '';
    position: absolute;
    top: -1px;
    left: -1px;
    right: -1px;
    bottom: -1px;
    background: rgba(59, 130, 246, 0.2);
    border-radius: 3px;
    z-index: -1;
  }

  @keyframes custom-pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
    }
    50% {
      box-shadow: 0 0 0 10px rgba(245, 158, 11, 0);
    }
  }
</style>
