<template>
  <div
    class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 p-4">
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- 标题 -->
      <div class="text-center space-y-2">
        <h1 class="text-4xl font-bold flex items-center justify-center gap-3">
          <i class="pi pi-book text-blue-600 text-3xl" />
          在阅读中渐进式学习英语
        </h1>
        <p>AI驱动 • 智能分析 • 分段学习 • 划选段落翻译</p>
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
                <Tag v-if="isStudying" severity="info" class="ml-auto"> 学习中... </Tag>
                <CommonSettingBtns class="ml-auto" />
                <Button
                  icon="pi pi-cog"
                  severity="secondary"
                  text
                  rounded
                  @click="showConfigPanel = true"
                  v-tooltip.left="$t('AI配置')" />
              </div>
            </template>
            <template #content>
              <div class="space-y-4">
                <div class="p-inputgroup flex">
                  <Textarea
                    v-model="syncData.article"
                    placeholder="请粘贴你想学习的英文文章..."
                    rows="5"
                    class="flex-1"
                    style="resize: none" />
                </div>
                <div class="flex gap-2 flex-wrap">
                  <Button
                    v-if="syncData.article"
                    icon="pi pi-times"
                    severity="secondary"
                    @click="syncData.article = ''"
                    label="清空" />
                  <Button
                    @click="handleArticleSubmit()"
                    class="flex-1"
                    :disabled="isAnalyzing"
                    severity="secondary"
                    :label="isAnalyzing ? 'AI分析中...' : '分段学习'" />
                  <Button
                    severity="secondary"
                    @click="loadSampleArticle()"
                    :disabled="isAnalyzing"
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
                  {{ completedParagraphs }}/{{ syncData.paragraphs.length }} 已完成
                </span>

                <Button
                  severity="secondary"
                  size="small"
                  @click="goToParagraph(syncData.currentParagraphIndex - 1)"
                  :disabled="syncData.currentParagraphIndex === 0"
                  icon="pi pi-angle-left"
                  v-tooltip.top="'上一段'" />
                <div class="flex-1 flex gap-1 overflow-x-auto">
                  <Button
                    v-for="(_, index) in syncData.paragraphs"
                    :key="index"
                    :severity="index === syncData.currentParagraphIndex ? 'primary' : 'secondary'"
                    size="small"
                    :class="[
                      'flex-1',
                      { 'bg-green-100 border-green-300': syncData.paragraphs[index]?.isCompleted },
                    ]"
                    @click="goToParagraph(index)"
                    :label="String(index + 1)"
                    :icon="syncData.paragraphs[index]?.isCompleted ? 'pi pi-check-circle' : ''" />
                </div>
                <Button
                  @click="handleParagraphComplete"
                  size="small"
                  icon="pi pi-check"
                  class="bg-blue-600 hover:bg-blue-700 text-white"
                  :disabled="syncData.paragraphs[syncData.currentParagraphIndex]?.isCompleted"
                  label="OK" />
              </div>
            </template>
            <template #content>
              <Tips
                title="使用提示："
                icon="pi-pencil"
                tips="点击单词查看详细翻译，或拖拽选择多个单词获取段落翻译，下方英文学习完毕后点击右上角的OK按钮" />
              <div
                id="article-container"
                class="text-lg leading-relaxed"
                @mousemove="handleMouseMove"
                @mouseup="handleMouseUp"
                @touchmove="handleMouseMove"
                @touchend="handleMouseUp"
                @touchstart="(e) => /** 防止长按选中文字以及触摸滚动 */ e.preventDefault()"
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
                <div
                  class="ml-auto flex items-center space-x-0.5"
                  v-if="selectedWord || paragraphTranslation">
                  <span class="">{{ ttsConfig.rate }}x</span>
                  <Slider
                    v-model="ttsConfig.rate"
                    :min="0.1"
                    :max="1.5"
                    :step="0.1"
                    class="w-32"
                    :title="$t(`调整发音速度，当前${ttsConfig.rate}倍速`)" />
                  <Button
                    text
                    rounded
                    @click="
                      translationType === 'word'
                        ? speakText(selectedWord?.word || '')
                        : speakText(paragraphTranslation?.originalText || '')
                    ">
                    <i class="pi pi-volume-up" style="font-size: 1rem" />
                  </Button>
                  <Button
                    text
                    rounded
                    @click="
                      translationType === 'word'
                        ? handleWordClick(selectedWord?.word || '', { forceAi: true })
                        : handleParagraphSelection(
                            (paragraphTranslation?.originalText || '').split(' '),
                          )
                    "
                    class="ml-auto"
                    :title="$t('重新使用ai翻译')">
                    <i class="pi pi-refresh" style="font-size: 1rem" />
                  </Button>
                </div>
              </div>
            </template>
            <template #content>
              <!-- 设置最小高度，减少翻译结果变化导致的跳动 -->
              <div class="space-y-4 min-h-[50rem]">
                <div v-if="showTranslation">
                  <div v-if="translationType === 'word' && selectedWord">
                    <!-- 单词翻译内容 -->
                    <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {{ selectedWord.word }}
                    </div>

                    <div
                      v-if="selectedWord.pronunciation"
                      class="text-lg text-gray-600 dark:text-gray-300">
                      <span class="text-sm text-gray-500 dark:text-gray-400">音标: </span>
                      {{ selectedWord.pronunciation }}
                    </div>

                    <div class="space-y-3">
                      <div class="flex items-center gap-2">
                        <i class="pi pi-brain" style="font-size: 1rem" />
                        <span class="text-sm text-gray-500 dark:text-gray-400">熟练度</span>
                        <Tag
                          :value="`${selectedWord.memoryLevel}/10`"
                          :style="{
                            backgroundColor: getMemoryColor(selectedWord.memoryLevel),
                            color: selectedWord.memoryLevel > 5 ? 'black' : 'white',
                            border: 'none',
                          }" />
                        <span
                          v-if="selectedWord.difficulty"
                          class="text-sm text-gray-500 dark:text-gray-400"
                          >难度</span
                        >
                        <Tag
                          v-if="selectedWord.difficulty"
                          :class="getDifficultyColor(selectedWord.difficulty)"
                          :value="`${selectedWord.difficulty}/10`" />
                      </div>

                      <Slider
                        v-model="selectedWord.memoryLevel"
                        @change="adjustMemoryLevel(selectedWord.word, Array.isArray($event) ? ($event[0] || 0) : ($event || 0))"
                        :min="0"
                        :max="10"
                        :step="1"
                        class="w-full" />
                    </div>

                    <div class="space-y-2 mt-2">
                      <div v-if="isTranslating" class="flex items-center gap-2 text-gray-500">
                        <i class="pi pi-refresh animate-spin" />
                        AI翻译中...
                      </div>
                      <div v-else class="text-lg">
                        {{ selectedWord.aiTranslation || '获取翻译中...' }}
                      </div>
                    </div>

                    <div v-if="selectedWord.grammar" class="space-y-2">
                      <div class="text-sm text-gray-500 dark:text-gray-400">语法信息</div>
                      <div class="text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        {{ selectedWord.grammar }}
                      </div>
                    </div>

                    <div v-if="selectedWord.examples?.length" class="space-y-2">
                      <div class="text-sm text-gray-500 dark:text-gray-400">AI例句</div>
                      <div class="space-y-1">
                        <div
                          v-for="(example, index) in selectedWord.examples"
                          :key="index"
                          class="text-sm bg-blue-50 dark:bg-blue-900/30 p-2 rounded italic">
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
                  <p class="text-sm mb-4">获取AI智能翻译和详细分析</p>
                  <Tips
                    v-if="isStudying"
                    title="💡 提示："
                    icon=""
                    :tips="`点击单词查看翻译会降低熟练度，完成段落时未操作的单词会提升熟练度(+1)`" />
                </div>
              </div>
            </template>
          </Card>
        </div>

        <!-- 右侧：翻译和统计 -->
        <div class="space-y-4 top-4 h-fit">
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
                  <div class="text-sm text-gray-600 dark:text-gray-300 mb-2">关键词汇 ⭐:</div>
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
                  <div
                    class="text-sm text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-1">
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
                当前片段学习统计
              </div>
            </template>
            <template #content>
              <div class="space-y-4">
                <div
                  class="text-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 rounded-lg">
                  <div class="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {{ stats.averageLevel }}
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">平均熟练度</div>
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
          <!-- 引流推广 -->
          <Card class="shadow-lg hover:shadow-xl transition-shadow duration-300 dark:bg-gray-800">
            <template #title>
              <div class="flex items-center gap-2 text-primary dark:text-primary-400">
                <i class="pi pi-lightbulb"></i>
                <span>实用推荐</span>
              </div>
            </template>
            <template #content>
              <div class="space-y-4 p-2">
                <!-- 联合推广块 -->
                <div
                  class="rounded-lg border border-purple-200 dark:border-purple-900/30 bg-purple-50/30 dark:bg-purple-900/10 hover:bg-purple-100/50 dark:hover:bg-purple-800/20 transition-colors duration-200">
                  <!-- 主推内容 -->
                  <a
                    href="http://xhslink.com/a/8ULZG6dHT63fb"
                    target="_blank"
                    class="block p-4 border-b border-purple-200/50 dark:border-purple-800">
                    <div class="flex items-start gap-3">
                      <Avatar
                        icon="pi pi-wrench  "
                        class="mt-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" />
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-gray-900 dark:text-white">
                          支持自定义 AI 模型
                        </div>
                        <div class="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                          点击文章输入上方工具栏最右侧的齿轮图标
                        </div>
                      </div>
                      <i
                        class="pi pi-external-link text-blue-400 dark:text-blue-500 self-center"></i>
                    </div>
                  </a>
                  <a
                    href="http://xhslink.com/a/8ULZG6dHT63fb"
                    target="_blank"
                    class="block p-4 border-b border-purple-200/50 dark:border-purple-800">
                    <div class="flex items-start gap-3">
                      <Avatar
                        icon="pi pi-microphone"
                        class="mt-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" />
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-gray-900 dark:text-white">
                          结合使用豆包来提升口语能力
                        </div>
                        <div class="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                          推荐教程 · xhslink.com/a/8ULZG6d...
                        </div>
                      </div>
                      <i
                        class="pi pi-external-link text-blue-400 dark:text-blue-500 self-center"></i>
                    </div>
                  </a>

                  <!-- 资源链接 -->
                  <a href="https://doubao.com/bot/JpGxseZo" target="_blank" class="block p-3">
                    <div class="flex items-center gap-3">
                      <Avatar
                        icon="pi pi-robot"
                        class="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" />
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-gray-900 dark:text-white">
                          推荐使用的豆包机器人
                        </div>
                        <div class="text-sm text-gray-500 dark:text-gray-400 truncate">
                          资源入口 · doubao.com/bot/JpGxseZo
                        </div>
                      </div>
                      <i class="pi pi-arrow-right text-green-400 dark:text-green-500"></i>
                    </div>
                  </a>
                </div>

                <!-- 后续推广可在此添加 -->
              </div>
            </template>
          </Card>
          <SponsorshipCard />
        </div>
      </div>
    </div>

    <!-- AI配置对话框 -->
    <Dialog
      v-model:visible="showConfigPanel"
      :header="$t('AI配置')"
      :modal="true"
      :style="{ width: '450px' }"
      :draggable="false">
      <AiEnglishConfigPanel @save="showConfigPanel = false" />
    </Dialog>
  </div>
</template>

<script setup lang="tsx">
  import {
    analyzeArticleWithAI,
    translateParagraphWithAI,
    translateWithAI,
    useCreateMixedTranslation,
    type AIAnalysis,
  } from '@/pages/AiEnglish/ai';
  import { useAiEnglishData } from '@/pages/AiEnglish/data';
  import { useTTS } from '@/pages/AiEnglish/util';
  import { useApiStorage } from '@/utils/hooks/UseApiStorage';
  import { useToast } from 'primevue/usetoast';
  import { computed, nextTick, reactive, ref, watch, watchEffect } from 'vue';
  import Dialog from 'primevue/dialog';
  import AiEnglishConfigPanel from '@/components/AiEnglishConfigPanel.vue';

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

  const { speakText, ttsConfig } = useTTS();

  const showConfigPanel = ref(false);

  // 需要存储同步的响应式状态
  const syncData = useApiStorage<{
    article: string;
    currentParagraphIndex: number;
    paragraphs: ParagraphData[];
  }>(
    'aiEnglish_syncData_v0',
    {
      article: '',
      paragraphs: [] as ParagraphData[],
      currentParagraphIndex: 0,
    },
    {
      mergeDefaults: true,
      pollingInterval: 25_500,
    },
  );

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
  const isStudying = computed(() => syncData.value.paragraphs.length > 0);
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
    if (syncData.value.paragraphs.length > 0) {
      return syncData.value.paragraphs[syncData.value.currentParagraphIndex]?.text || '';
    }
    return syncData.value.article;
  });

  const completedParagraphs = computed(
    () => syncData.value.paragraphs.filter((p) => p.isCompleted).length,
  );

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

  /** 获取单词数据 */
  watchEffect(async () => {
    const text = syncData.value.paragraphs[syncData.value.currentParagraphIndex]?.text;
    if (!text) return;
    const tokens = tokenizeText(text);
    await getWordsData(tokens);
  });

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
  const initializeWords = async (text: string) => {
    currentSession.clickedWords = new Set();
    currentSession.startTime = Date.now();

    syncData.value.paragraphs = splitArticleIntoParagraphs(text);
    syncData.value.currentParagraphIndex = 0;

    // AI分析
    isAnalyzing.value = true;
    try {
      aiAnalysis.value = await analyzeArticleWithAI(text);
    } catch (error) {
      console.error('AI分析失败:', error);
      // 显示错误提示给用户
      toast.add({
        severity: 'error',
        summary: 'AI分析失败',
        detail: error instanceof Error ? error.message : '未知错误',
        life: 3000,
      });
    } finally {
      isAnalyzing.value = false;
    }

    toast.add({
      severity: 'success',
      summary: '开始学习',
      detail: `已分割为 ${syncData.value.paragraphs.length} 个段落，开始第一段学习！`,
      life: 3000,
    });
  };

  const handleArticleSubmit = () => {
    if (syncData.value.article.trim()) initializeWords(syncData.value.article);
  };

  const loadSampleArticle = () => {
    syncData.value.article = sampleArticle;
    initializeWords(sampleArticle);
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

  const handleMouseDown = (e: { preventDefault: () => void }, wordIndex: number) => {
    if (!isStudying.value) return;
    if (e instanceof MouseEvent) {
      e.preventDefault();
    }

    selectionState.isSelecting = true;
    selectionState.startWordIndex = wordIndex;
    selectionState.endWordIndex = wordIndex;
    selectionState.selectedWords = new Set([wordIndex]);
  };

  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (!selectionState.isSelecting || !isStudying.value) return;

    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
    const wordIndex = getWordIndexFromPoint(clientX || 0, clientY || 0);
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
      /** 因为触摸设备上的事件判定机制会导致 onClick 中的逻辑无法触发，所以需要在这里处理单个单词的点击事件  */
      handleWordClick(selectedWordsData[0] || '');
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
        detail: '段落翻译服务暂时不可用:' + error,
        life: 3000,
      });
    } finally {
      isTranslating.value = false;
    }

    speakText(selectedText);
  };

  const handleWordClick = async (word: string, options?: { forceAi: boolean }) => {
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
    if (!wordData.aiTranslation || options?.forceAi) {
      isTranslating.value = true;
      try {
        const aiResult = await translateWithAI(word, currentText.value);
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
      } catch (error) {
        console.error('AI翻译失败:', error);
        // 显示错误提示给用户
        toast.add({
          severity: 'error',
          summary: 'AI翻译失败',
          detail: error instanceof Error ? error.message : '未知错误',
          life: 3000,
        });
      } finally {
        isTranslating.value = false;
      }
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
    if (!isStudying.value) return;

    const currentParagraph = syncData.value.paragraphs[syncData.value.currentParagraphIndex];
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
    syncData.value.paragraphs = syncData.value.paragraphs.map((p, index) =>
      index === syncData.value.currentParagraphIndex ? { ...p, isCompleted: true } : p,
    );
    syncData.value.currentParagraphIndex += 1;
    // 重置会话
    currentSession.clickedWords = new Set();
    showTranslation.value = false;
    highlightedWord.value = '';
    selectionState.selectedWords = new Set();

    toast.add({
      severity: 'success',
      summary: '段落学习完成！',
      detail: `第${
        syncData.value.currentParagraphIndex + 1
      }段完成！${improvedCount} 个单词熟练度提升了 +1`,
      life: 4000,
    });
  };

  const goToParagraph = (index: number) => {
    if (index >= 0 && index < syncData.value.paragraphs.length) {
      syncData.value.currentParagraphIndex = index;
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
        else if (isSelected) className += ` bg-blue-100 font-medium word-selected`;
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
            onTouchstart={(e) => handleMouseDown(e, currentWordIndex)}
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
  watch(
    () => [currentText.value, words.value, syncData.value.currentParagraphIndex],
    () => {
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
    },
  );

  watch(aiAnalysis, (val) => val && (showAiAnalysis.value = true));

  function Tips(props: { tips: string; title: string; icon: string }) {
    return (
      <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div class="flex flex-col sm:flex-row items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
          <i class={`pi ${props.icon} text-sm!`} />
          <span class="font-medium">{props.title}</span>
          <span>{props.tips}</span>
        </div>
      </div>
    );
  }
</script>

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
