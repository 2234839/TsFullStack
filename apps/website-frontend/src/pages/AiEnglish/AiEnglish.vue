<template>
  <div
    class="min-h-screen bg-linear-to-br from-primary-50 to-secondary-50 dark:from-primary-900 dark:to-secondary-900 p-4">
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- 标题区域 -->
      <div class="flex items-center gap-4">
        <Tooltip :content="t('返回首页')" side="right">
          <Button
            icon="pi pi-arrow-left"
            variant="secondary"
            @click="routerUtil.push(routeMap.index, undefined as any)"
            class="text-base! px-4! py-2!">
            返回首页
          </Button>
        </Tooltip>
        <div class="flex-1 text-center">
          <h1 class="text-3xl font-bold flex items-center justify-center gap-3">
            <i class="pi pi-book text-primary-600 text-2xl" />
            在阅读中渐进式学习英语
          </h1>
          <p class="text-sm mt-1">AI驱动 • 智能分析 • 分段学习 • 划选段落翻译</p>
        </div>
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
                <Tag v-if="isStudying" variant="info" class="ml-auto"> 学习中... </Tag>
                <CommonSettingBtns class="ml-auto" />
                <Tooltip :content="t('AI配置')" side="left">
                  <Button
                    icon="pi pi-cog"
                    variant="icon"
                    rounded
                    @click="showConfigPanel = true" />
                </Tooltip>
              </div>
            </template>
            <template #content>
              <div class="space-y-4">
                <div class="p-inputgroup flex">
                  <Textarea
                    v-model="syncData.article"
                    placeholder="请粘贴你想学习的英文文章..."
                    :rows="5"
                    class="flex-1"
                    style="resize: none" />
                </div>
                <div class="space-y-3">
                  <div class="flex gap-2 flex-wrap">
                    <Button
                      v-if="syncData.article"
                      icon="pi pi-times"
                      variant="secondary"
                      @click="syncData.article = ''"
                      label="清空" />
                    <div class="flex-1 flex gap-1">
                      <Button
                        @click="handleArticleSubmit(true)"
                        class="flex-1"
                        :disabled="isAnalyzing || isSegmenting"
                        variant="primary"
                        :label="isSegmenting ? 'AI分段中...' : isAnalyzing ? 'AI分析中...' : 'AI智能分段'" />
                      <Tooltip content="使用传统分段方式（基于空行和句号）" side="top">
                        <Button
                          @click="handleArticleSubmit(false)"
                          variant="secondary"
                          :disabled="isAnalyzing || isSegmenting"
                          :label="'传统分段'" />
                      </Tooltip>
                    </div>
                    <Button
                      variant="secondary"
                      @click="loadSampleArticle()"
                      :disabled="isAnalyzing || isSegmenting"
                      label="示例分段" />
                  </div>

                  <!-- 智能分段选项说明 -->
                  <div class="flex items-center gap-2 text-xs text-primary-500 dark:text-primary-400">
                    <i class="pi pi-sparkles text-secondary-500"></i>
                    <span>AI智能分段会根据内容逻辑和阅读体验进行优化，确保每个段落信息量适中</span>
                  </div>
                </div>
              </div>
            </template>
          </Card>

          <!-- 文章显示 -->
          <Card v-if="words.length > 0">
            <template #title>
              <!-- 显示段落进度和操作按钮 -->
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <i class="pi pi-book" style="font-size: 1.25rem" />
                  <span class="text-sm text-secondary-600 dark:text-secondary-400" title="段落进度">
                    {{ completedParagraphs }}/{{ syncData.paragraphs.length }} 已完成
                  </span>
                  <Tooltip content="智能分段信息" side="top">
                    <Button
                      v-if="smartSegmentation"
                      variant="text-button"
                      size="small"
                      rounded
                      @click="showSegmentationInfo = !showSegmentationInfo"
                      icon="pi pi-sparkles" />
                  </Tooltip>
                </div>

                <!-- 智能分段信息条 -->
                <div v-if="showSegmentationInfo && smartSegmentation"
                     class="p-2 bg-secondary-50 dark:bg-secondary-900/20 rounded-lg text-xs">
                  <div class="flex items-center gap-1 text-secondary-700 dark:text-secondary-300">
                    <i class="pi pi-sparkles"></i>
                    <span class="font-medium">AI智能分段</span>
                    <span class="ml-auto">{{ smartSegmentation.estimatedTotalTime }}分钟预计</span>
                  </div>
                  <div class="text-secondary-600 dark:text-secondary-400 mt-1">
                    {{ smartSegmentation.segmentationStrategy }}
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <Tooltip content="上一段" side="top">
                    <Button
                      variant="secondary"
                      size="small"
                      @click="goToParagraph(syncData.currentParagraphIndex - 1)"
                      :disabled="syncData.currentParagraphIndex === 0"
                      icon="pi pi-angle-left" />
                  </Tooltip>
                  <div class="flex-1 flex gap-1 overflow-x-auto">
                    <Tooltip
                      v-for="(paragraph, index) in syncData.paragraphs"
                      :key="index"
                      :content="getParagraphTooltip(paragraph, index)"
                      side="top">
                      <Button
                        :variant="index === syncData.currentParagraphIndex ? 'primary' : 'secondary'"
                        size="small"
                        :class="[
                          'flex-1',
                          { 'bg-success-100 border-success-300': paragraph.isCompleted },
                          { 'bg-secondary-100 border-secondary-300': paragraph.complexity && paragraph.complexity > 7 },
                        ]"
                        @click="goToParagraph(index)"
                        :label="String(index + 1)"
                        :icon="paragraph.isCompleted ? 'pi pi-check-circle' : ''" />
                    </Tooltip>
                  </div>
                  <Button
                    @click="handleParagraphComplete"
                    size="small"
                    icon="pi pi-check"
                    class="bg-primary-600 hover:bg-primary-700 text-white"
                    :disabled="syncData.paragraphs[syncData.currentParagraphIndex]?.isCompleted"
                    label="OK" />
                </div>
              </div>
            </template>
            <template #content>
              <AiEnglishTips
                title="使用提示："
                icon="pi-pencil"
                tips="点击单词查看详细翻译，或拖拽选择多个单词获取段落翻译，下方英文学习完毕后点击右上角的OK按钮" />
              <div
                id="article-container"
                class="text-lg leading-relaxed max-h-96 overflow-y-auto"
                @mousemove="handleMouseMove"
                @mouseup="handleMouseUp"
                @touchmove="handleMouseMove"
                @touchend="handleMouseUp"
                @touchstart="(e) => /** 防止长按选中文字以及触摸滚动 */ e.preventDefault()"
                style="user-select: none; padding: 1rem;">
                <ParagraphRenderer
                  v-if="currentText"
                  :text="currentText"
                  :currentParagraphKeyWords="currentParagraph?.keyVocabulary || []"
                  :complexity="currentParagraph?.complexity || 5"
                  :estimatedReadingTime="currentParagraph?.estimatedReadingTime"
                  :getWordData="getWordData"
                  :currentSession="currentSession"
                  :selectionState="selectionState"
                  :highlightedWordIndex="highlightedWordIndex"
                  :aiAnalysis="aiAnalysis"
                  @wordMouseDown="handleMouseDown"
                />
              </div>
            </template>
          </Card>
          <!-- 翻译面板 -->
          <Card>
            <template #title>
              <div class="flex items-center gap-2">
                <i class="pi pi-sparkles text-secondary-600" style="font-size: 1.25rem" />
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
                    :title="t(`调整发音速度，当前${ttsConfig.rate}倍速`)" />
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
                    :title="t('重新使用ai翻译')">
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
                    <div class="text-2xl font-bold text-primary-700 dark:text-primary-300">
                      {{ selectedWord.word }}
                    </div>

                    <div
                      v-if="selectedWord.pronunciation"
                      class="text-lg text-primary-700 dark:text-primary-300">
                      <span class="text-sm text-primary-500 dark:text-primary-400">音标: </span>
                      {{ selectedWord.pronunciation }}
                    </div>

                    <div class="space-y-3">
                      <div class="flex items-center gap-2">
                        <i class="pi pi-brain" style="font-size: 1rem" />
                        <span class="text-sm text-primary-500 dark:text-primary-400">熟练度</span>
                        <Tag
                          :value="`${selectedWord.memoryLevel}/10`"
                          :style="{
                            backgroundColor: getMemoryColor(selectedWord.memoryLevel),
                            color: selectedWord.memoryLevel > 5 ? 'black' : 'white',
                            border: 'none',
                          }" />
                        <span
                          v-if="selectedWord.difficulty"
                          class="text-sm text-primary-500 dark:text-primary-400"
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

                    <!-- 使用GlassBlur组件控制翻译内容的显示 -->
                    <GlassBlur
                      :key="selectedWord.word"
                      :initialBlurred="shouldUseBlur"
                      :overlayText="selectedWord.memoryLevel > 4 ? '悬停查看翻译' : '点击查看翻译'"
                      :toggleOnClick="true"
                      :autoClear="selectedWord.memoryLevel <= 4"
                      overlayClass="bg-primary-100/80 dark:bg-primary-800/80 backdrop-blur-[1px]"
                      overlayTextClass="text-primary-600 dark:text-primary-400 text-xs"
                      @click="handleTranslationClick">
                      <div class="space-y-2">
                        <div v-if="isTranslating" class="flex items-center gap-2 text-primary-500">
                          <i class="pi pi-refresh animate-spin" />
                          AI翻译中...
                        </div>
                        <div v-else class="text-lg">
                          {{ selectedWord.aiTranslation || '获取翻译中...' }}
                        </div>
                      </div>

                      <div v-if="selectedWord.grammar" class="space-y-2">
                        <div class="text-sm text-primary-500 dark:text-primary-400">语法信息</div>
                        <div class="text-sm bg-primary-50 dark:bg-primary-700 p-2 rounded">
                          {{ selectedWord.grammar }}
                        </div>
                      </div>

                      <div v-if="selectedWord.examples?.length" class="space-y-2">
                        <div class="text-sm text-primary-500 dark:text-primary-400">AI例句</div>
                        <div class="space-y-1">
                          <div
                            v-for="(example, index) in selectedWord.examples"
                            :key="index"
                            class="text-sm bg-primary-50 dark:bg-primary-900/30 p-2 rounded italic">
                            {{ example }}
                          </div>
                        </div>
                      </div>

                      <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div class="text-primary-500 dark:text-primary-400">查看次数</div>
                          <div class="font-medium">{{ selectedWord.clickCount }} 次</div>
                        </div>
                        <div>
                          <div class="text-primary-500 dark:text-primary-400">眼熟度</div>
                          <div class="font-medium">
                            <span :class="getFamiliarityColor(selectedWord.familiarity)">
                              {{ Math.round(selectedWord.familiarity) }}%
                            </span>
                            <span class="text-xs text-gray-500 dark:text-gray-400">
                              ({{ getFamiliarityLabel(selectedWord.familiarity) }})
                            </span>
                          </div>
                        </div>
                      </div>
                    </GlassBlur>
                  </div>

                  <div v-else-if="paragraphTranslation">
                    <!-- 段落翻译内容 -->
                    <div class="space-y-3">
                      <div class="space-y-2">
                        <div v-if="isTranslating" class="flex items-center gap-2 text-primary-500">
                          <i
                            class="pi pi-refresh"
                            style="font-size: 1rem; animation: spin 1s linear infinite" />
                          AI翻译中...
                        </div>
                        <div v-else class="p-3 bg-primary-50 rounded-lg">
                          <div class="leading-relaxed">
                            {{ paragraphTranslation.mixedTranslation }}
                          </div>
                          <div class="text-xs text-primary-600 mt-2">
                            💡 熟悉的单词保持英文显示，帮助巩固记忆
                          </div>
                        </div>
                      </div>

                      <div class="space-y-2" v-if="!isTranslating && paragraphTranslation">
                        <div class="text-sm text-primary-500 dark:text-primary-400">完整中文翻译</div>
                        <GlassBlur
                          :key="paragraphTranslation?.originalText"
                          :overlay-text="'鼠标悬停或点击查看翻译'"
                          :container-class="'p-3 bg-success-50/80 rounded-lg border border-success-100/50 hover:bg-success-50/95'"
                          :overlay-class="'bg-success-50/60 backdrop-blur-[1px]'"
                          :overlay-text-class="'text-success-700/80'">
                          <div class="text-base leading-relaxed">
                            {{ paragraphTranslation.translatedText }}
                          </div>
                        </GlassBlur>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="text-center py-8 text-primary-500">
                  <i class="pi pi-sparkles w-12 h-12 mx-auto mb-4 text-primary-300" />
                  <p class="text-lg font-medium mb-2">点击单词或拖拽选择段落</p>
                  <p class="text-sm mb-4">获取AI智能翻译和详细分析</p>
                  <AiEnglishTips
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
          <!-- 智能分段信息 -->
          <Card v-if="smartSegmentation" class="border-secondary-200 bg-secondary-50">
            <template #title>
              <div
                class="flex items-center gap-2 cursor-pointer"
                @click="showSegmentationInfo = !showSegmentationInfo">
                <i class="pi pi-sparkles" style="font-size: 1.25rem; color: #9333ea" />
                智能分段信息
                <span class="ml-auto text-sm text-secondary-600">{{
                  showSegmentationInfo ? '收起' : '展开'
                }}</span>
              </div>
            </template>
            <template v-if="showSegmentationInfo" #content>
              <div class="space-y-4">
                <div class="text-sm">
                  <div class="font-medium text-secondary-700 mb-2">分段策略</div>
                  <div class="text-secondary-600">{{ smartSegmentation.segmentationStrategy }}</div>
                </div>

                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-bookmark text-secondary-600" />
                    <span>总段落数:</span>
                    <Tag :value="smartSegmentation.totalSegments.toString()" variant="info" />
                  </div>
                  <div class="flex items-center gap-2">
                    <i class="pi pi-clock text-secondary-600" />
                    <span>预计时间:</span>
                    <Tag :value="`${smartSegmentation.estimatedTotalTime}分钟`" />
                  </div>
                </div>

                <!-- 当前段落详细信息 -->
                <div v-if="currentParagraph" class="border-t pt-3">
                  <div class="font-medium text-secondary-700 mb-2">当前段落</div>
                  <div class="space-y-2 text-sm">
                    <div v-if="currentParagraph.complexity" class="flex items-center gap-2">
                      <span class="text-primary-600 dark:text-primary-400">复杂度:</span>
                      <Tag
                        :value="`${currentParagraph.complexity}/10`"
                        :class="getDifficultyColor(currentParagraph.complexity)" />
                    </div>
                    <div v-if="currentParagraph.estimatedReadingTime" class="flex items-center gap-2">
                      <span class="text-primary-600 dark:text-primary-400">预计阅读:</span>
                      <Tag :value="`${Math.ceil(currentParagraph.estimatedReadingTime / 60)}分钟`" variant="info" />
                    </div>
                    <div v-if="currentParagraph.reason" class="flex items-start gap-2">
                      <span class="text-primary-600 dark:text-primary-400">分段理由:</span>
                      <span class="text-secondary-600 dark:text-secondary-400 flex-1">{{ currentParagraph.reason }}</span>
                    </div>
                    <div v-if="currentParagraph.keyVocabulary && currentParagraph.keyVocabulary.length > 0"
                         class="flex items-start gap-2">
                      <span class="text-primary-600 dark:text-primary-400">关键词:</span>
                      <div class="flex flex-wrap gap-1">
                        <Tag
                          v-for="word in currentParagraph.keyVocabulary"
                          :key="word"
                          variant="secondary"
                          class="text-xs">
                          {{ word }}
                        </Tag>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </Card>

          <!-- AI分析结果 -->
          <Card v-if="aiAnalysis" class="border-secondary-200 bg-secondary-50">
            <template #title>
              <div
                class="flex items-center gap-2 cursor-pointer"
                @click="showAiAnalysis = !showAiAnalysis">
                <i class="pi pi-star-fill" style="font-size: 1.25rem; color: #9333ea" />
                AI智能分析
                <span class="ml-auto text-sm text-secondary-600">{{
                  showAiAnalysis ? '收起' : '展开'
                }}</span>
              </div>
            </template>
            <template v-if="showAiAnalysis" #content>
              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-bullseye text-secondary-600" style="font-size: 1rem" />
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
                  <div class="text-sm text-primary-600 dark:text-primary-300 mb-2">关键词汇 ⭐:</div>
                  <div class="flex flex-wrap gap-1">
                    <Tag
                      v-for="(word, index) in aiAnalysis.keyWords"
                      :key="index"
                      variant="info"
                      class="text-xs">
                      {{ word }}
                    </Tag>
                  </div>
                </div>

                <div v-if="aiAnalysis.learningTips.length > 0">
                  <div
                    class="text-sm text-primary-600 dark:text-primary-300 mb-2 flex items-center gap-1">
                    <i class="pi pi-lightbulb" style="font-size: 1rem" />
                    学习建议:
                  </div>
                  <ul class="text-sm space-y-1">
                    <li
                      v-for="(tip, index) in aiAnalysis.learningTips"
                      :key="index"
                      class="flex items-start gap-2">
                      <span class="text-secondary-600">•</span>
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
                  class="text-center p-4 bg-linear-to-r from-info-50 to-secondary-50 dark:from-primary-700 dark:to-secondary-700 rounded-lg">
                  <div class="text-3xl font-bold text-primary-600 dark:text-primary-400">
                    {{ stats.averageLevel }}
                  </div>
                  <div class="text-sm text-primary-500 dark:text-primary-400">平均熟练度</div>
                </div>

                <div class="space-y-3">
                  <div class="flex justify-between items-center">
                    <span class="text-sm">总词汇量</span>
                    <Tag :value="stats.total.toString()" variant="info" />
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
                    <div class="text-2xl font-bold text-success-600">
                      {{ Math.round(((stats.mastered + stats.familiar) / stats.total) * 100) }}%
                    </div>
                    <div class="text-sm text-primary-500 dark:text-primary-400">掌握率</div>
                  </div>
                </div>
              </div>
            </template>
          </Card>
          <SponsorshipCard />
        </div>
      </div>
    </div>

    <!-- AI配置对话框 -->
    <Dialog
      v-model:open="showConfigPanel"
      :title="t('AI配置')">
      <AiEnglishConfigPanel @save="showConfigPanel = false" />
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import {
    analyzeArticleWithAI,
    translateParagraphWithAI,
    translateWithAI,
    useCreateMixedTranslation,
    segmentArticleWithAI,
    type AIAnalysis,
    type SmartSegmentationResult,
  } from '@/pages/AiEnglish/ai';
  import { useAiEnglishData } from '@/pages/AiEnglish/data';
  import { useTTS } from '@/pages/AiEnglish/util';
  import { useApiStorage } from '@/utils/hooks/UseApiStorage';
  import { useToast } from '@/composables/useToast';
  import { computed, reactive, ref, watch, watchEffect } from 'vue';
  import { Dialog } from '@tsfullstack/shared-frontend/components';
  import { Tooltip } from '@tsfullstack/shared-frontend/components';
  import AiEnglishConfigPanel from '@/components/AiEnglishConfigPanel.vue';
  import ParagraphRenderer from '@/components/ParagraphRenderer.vue';
  import AiEnglishTips from '@/components/AiEnglishTips.vue';
  import GlassBlur from '@/components/GlassBlur.vue';
  import { useI18n } from '@/composables/useI18n';
  import { routerUtil } from '@/router';
  import { routeMap } from '@/router';

  const { t } = useI18n();

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
    reason?: string; // AI分段理由
    complexity?: number; // 复杂度
    estimatedReadingTime?: number; // 预估阅读时间
    keyVocabulary?: string[]; // 关键词汇
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
  const smartSegmentation = ref<SmartSegmentationResult | null>(null);
  const isSegmenting = ref(false);
  const showSegmentationInfo = ref(false);

  // 当前段落计算属性，避免重复的模板表达式
  const currentParagraph = computed(() => syncData.value.paragraphs[syncData.value.currentParagraphIndex]);
  const selectionState = reactive<SelectionState>({
    isSelecting: false,
    startWordIndex: -1,
    endWordIndex: -1,
    selectedWords: new Set(),
  });
  // wordElements 已移除，改为直接通过单词索引获取
  const highlightedWord = ref('');
  const highlightedWordIndex = ref(-1);
  const toast = useToast();

  // 判断是否应该使用模糊效果的计算属性
  const shouldUseBlur = computed(() => {
    return (selectedWord.value?.memoryLevel ?? 0) > 4;
  });

  // 处理翻译点击事件，只有查看模糊内容时才减少熟练度
  const handleTranslationClick = () => {
    if (!selectedWord.value) return;

    // 只有熟练度 > 4 的单词在查看翻译内容时才减少熟练度
    if (selectedWord.value.memoryLevel > 4) {
      const wordData = getWordData(selectedWord.value.word);
      if (wordData) {
        const newMemoryLevel = Math.max(0, wordData.memoryLevel - 1);
        const oldWordData = words.value.find((el) => el.word === selectedWord.value?.word);
        if (oldWordData) {
          const newClickCount = oldWordData.clickCount + 1;
          updateWordDatas([
            {
              ...oldWordData,
              memoryLevel: newMemoryLevel,
              clickCount: newClickCount,
              lastClickTime: new Date(),
              familiarity: calculateFamiliarity(newClickCount, new Date()),
            },
          ]);
          console.log(`查看模糊翻译内容 ${selectedWord.value.word} 熟练度 -1 (当前: ${newMemoryLevel}/10)`);
        }
      }
    }
  };

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

  /** 计算眼熟度标签 */
  const getFamiliarityLabel = (familiarity: number): string => {
    const level = Math.round(familiarity);
    if (level >= 80) return '非常眼熟';
    if (level >= 60) return '比较眼熟';
    if (level >= 40) return '有点印象';
    if (level >= 20) return '似曾相识';
    return '完全陌生';
  };

  /** 计算眼熟度颜色 */
  const getFamiliarityColor = (familiarity: number): string => {
    const level = Math.round(familiarity);
    if (level >= 80) return 'text-success-600 dark:text-success-400';
    if (level >= 60) return 'text-primary-600 dark:text-primary-400';
    if (level >= 40) return 'text-warning-600 dark:text-warning-400';
    if (level >= 20) return 'text-orange-600 dark:text-orange-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getDifficultyColor = (difficulty: number): string => {
    if (difficulty <= 3) return 'text-success-600';
    if (difficulty <= 6) return 'text-warning-600';
    return 'text-danger-600';
  };

  /** 计算眼熟度 (0-100) */
  const calculateFamiliarity = (clickCount: number, lastClickTime: Date): number => {
    const now = new Date();
    const lastClick = new Date(lastClickTime);
    const daysSinceLastClick = Math.max(0, (now.getTime() - lastClick.getTime()) / (1000 * 60 * 60 * 24));

    // 基础眼熟度：每次点击增加10分
    const baseFamiliarity = Math.min(100, clickCount * 10);

    // 时间衰减：30天衰减20分
    const timeDecay = Math.min(20, (daysSinceLastClick / 30) * 20);

    // 最终眼熟度
    const familiarity = Math.max(0, Math.min(100, baseFamiliarity - timeDecay));
    return familiarity;
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
    // 改进分段逻辑：保持原始换行，同时处理段落分隔
    const paragraphs: string[] = [];

    // 首先按双换行分割段落
    const majorParagraphs = text.split(/\n\s*\n/);

    for (const majorParagraph of majorParagraphs) {
      const trimmed = majorParagraph.trim();
      if (trimmed.length > 0) {
        // 如果段落太长，按句子进一步分割
        const sentences = trimmed.match(/[^.!?]+[.!?]+/g) || [trimmed];

        let currentParagraph = '';
        for (const sentence of sentences) {
          const testParagraph = currentParagraph + (currentParagraph ? ' ' : '') + sentence.trim();

          // 如果当前段落超过150词，或者有明确的主题转换，则分段
          if (currentParagraph && (tokenizeText(testParagraph).length > 150 || sentence.match(/^\s*(However|Therefore|Moreover|Furthermore|In conclusion|On the other hand)\s/i))) {
            paragraphs.push(currentParagraph.trim());
            currentParagraph = sentence.trim();
          } else {
            currentParagraph = testParagraph;
          }
        }

        if (currentParagraph.trim()) {
          paragraphs.push(currentParagraph.trim());
        }
      }
    }

    return paragraphs.map((text, index) => ({
      id: index,
      text: text.endsWith('.') || text.endsWith('!') || text.endsWith('?') ? text : text + '.',
      words: tokenizeText(text),
      isCompleted: false,
      reason: '传统分段（基于换行和句子结构）',
      complexity: 5, // 默认复杂度
      estimatedReadingTime: Math.ceil(tokenizeText(text).length * 0.3),
      keyVocabulary: []
    }));
  };

  // AI智能分段函数
  const segmentArticleIntelligently = async (text: string): Promise<ParagraphData[]> => {
    isSegmenting.value = true;
    try {
      const result = await segmentArticleWithAI(text);
      smartSegmentation.value = result;

      return result.paragraphs.map((paragraph, index) => ({
        id: index,
        text: paragraph.text,
        words: tokenizeText(paragraph.text),
        isCompleted: false,
        reason: paragraph.reason,
        complexity: paragraph.complexity,
        estimatedReadingTime: paragraph.estimatedReadingTime,
        keyVocabulary: paragraph.keyVocabulary,
      }));
    } catch (error) {
      console.error('AI智能分段失败:', error);
      toast.add({
        variant: 'warn',
        summary: '智能分段失败',
        detail: '回退到传统分段方式',
        life: 3000,
      });
      return splitArticleIntoParagraphs(text);
    } finally {
      isSegmenting.value = false;
    }
  };

  // 核心功能
  const initializeWords = async (text: string, useSmartSegmentation = true) => {
    currentSession.clickedWords = new Set();
    currentSession.startTime = Date.now();

    // 使用智能分段或传统分段
    syncData.value.paragraphs = useSmartSegmentation
      ? await segmentArticleIntelligently(text)
      : splitArticleIntoParagraphs(text);
    syncData.value.currentParagraphIndex = 0;

    // AI分析（并行执行以提高性能）
    isAnalyzing.value = true;
    try {
      const [analysisResult] = await Promise.all([
        analyzeArticleWithAI(text),
        // 如果使用智能分段，可以在这里添加其他并行任务
      ]);
      aiAnalysis.value = analysisResult;
    } catch (error) {
      console.error('AI分析失败:', error);
      // 显示错误提示给用户
      toast.add({
        variant: 'error',
        summary: 'AI分析失败',
        detail: error instanceof Error ? error.message : '未知错误',
        life: 3000,
      });
    } finally {
      isAnalyzing.value = false;
    }

    const segmentInfo = smartSegmentation.value
      ? `AI智能分段完成！${smartSegmentation.value.segmentationStrategy}`
      : `已分割为 ${syncData.value.paragraphs.length} 个段落`;

    toast.add({
      variant: 'success',
      summary: '开始学习',
      detail: `${segmentInfo}，开始第一段学习！`,
      life: 3000,
    });
  };

  const handleArticleSubmit = (useSmartSegmentation = true) => {
    if (syncData.value.article.trim()) initializeWords(syncData.value.article, useSmartSegmentation);
  };

  const loadSampleArticle = () => {
    syncData.value.article = sampleArticle;
    initializeWords(sampleArticle, true);
  };

  // 获取段落工具提示
  const getParagraphTooltip = (paragraph: ParagraphData, index: number): string => {
    let tooltip = `段落 ${index + 1}`;

    if (paragraph.complexity) {
      tooltip += ` • 复杂度: ${paragraph.complexity}/10`;
    }

    if (paragraph.estimatedReadingTime) {
      tooltip += ` • 预计: ${Math.ceil(paragraph.estimatedReadingTime / 60)}分钟`;
    }

    if (paragraph.keyVocabulary && paragraph.keyVocabulary.length > 0) {
      tooltip += ` • 关键词: ${paragraph.keyVocabulary.slice(0, 3).join(', ')}`;
    }

    if (paragraph.reason && paragraph.reason.length > 0) {
      tooltip += `\n分段理由: ${paragraph.reason}`;
    }

    return tooltip;
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

    const selectedWordIndices = Array.from(selectionState.selectedWords).sort((a, b) => a - b);
    selectionState.isSelecting = false;
    selectionState.startWordIndex = -1;
    selectionState.endWordIndex = -1;

    if (selectedWordIndices.length === 0) return;

    // 获取选中的单词 - 直接通过索引获取，无需DOM查询
    const selectedWordsData = selectedWordIndices
      .map((index) => getWordByIndex(index))
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
    highlightedWordIndex.value = -1;
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
        variant: 'error',
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
    highlightedWordIndex.value = -1;

    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    highlightedWord.value = cleanWord;

    // 找到单词在段落中的索引
    const paragraphWords = currentParagraph.value?.words || [];
    const wordIndex = paragraphWords.indexOf(cleanWord);
    if (wordIndex !== -1) {
      highlightedWordIndex.value = wordIndex;
    }

    const wordData = getWordData(word);
    if (!wordData) return;

    // 更新会话
    currentSession.clickedWords.add(cleanWord);

    selectedWordKey.value = word;
    showTranslation.value = true;
    translationType.value = 'word';
    paragraphTranslation.value = null;

    // 根据熟练度决定是否立即减少熟练度
    // 熟练度 <= 4 的单词立即减少熟练度，熟练度 > 4 的单词在查看模糊内容时才减少
    const shouldDecreaseNow = wordData.memoryLevel <= 4;
    const newMemoryLevel = shouldDecreaseNow ? Math.max(0, wordData.memoryLevel - 1) : wordData.memoryLevel;

    // 获取AI翻译（如果缺失）
    if (!wordData.aiTranslation || options?.forceAi) {
      isTranslating.value = true;
      try {
        const aiResult = await translateWithAI(word, currentText.value);
        const oldWordData = words.value.find((el) => el.word === word.toLowerCase());
        if (oldWordData) {
          const newClickCount = oldWordData.clickCount + 1;
          updateWordDatas([
            {
              ...oldWordData,
              memoryLevel: newMemoryLevel,
              clickCount: newClickCount,
              lastClickTime: new Date(),
              familiarity: calculateFamiliarity(newClickCount, new Date()),
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
          variant: 'error',
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
        const newClickCount = oldWordData.clickCount + 1;
        updateWordDatas([
          {
            ...oldWordData,
            memoryLevel: newMemoryLevel,
            clickCount: newClickCount,
            lastClickTime: new Date(),
            familiarity: calculateFamiliarity(newClickCount, new Date()),
          },
        ]);
      }
    }

    // 如果立即减少了熟练度，输出日志
    if (shouldDecreaseNow) {
      console.log(`查看翻译 ${word} 熟练度 -1 (当前: ${newMemoryLevel}/10) - 低熟练度单词立即减少`);
    }

    speakText(word);
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
    highlightedWordIndex.value = -1;
    selectionState.selectedWords = new Set();

    toast.add({
      variant: 'success',
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
      highlightedWord.value = '';
      highlightedWordIndex.value = -1;
    }
  };

  const adjustMemoryLevel = (word: string, newLevel: number) => {
    const updates = words.value.map((w) => (w.word === word ? { ...w, memoryLevel: newLevel } : w));
    updateWordDatas(updates);

    if (selectedWord.value?.word === word) {
      selectedWord.value.memoryLevel = newLevel;
    }
  };

  
    
// 通过单词索引直接获取对应的单词 - 使用当前段落的words数组
const getWordByIndex = (wordIndex: number): string => {
  const paragraphWords = currentParagraph.value?.words || [];
  if (wordIndex >= 0 && wordIndex < paragraphWords.length) {
    return paragraphWords[wordIndex] || '';
  }
  return '';
};

  watch(aiAnalysis, (val) => val && (showAiAnalysis.value = true));

  </script>

<style scoped>
  .custom-highlight-pulse {
    animation: custom-pulse 2s infinite;
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

  /* 段落排版优化 */
  #article-container {
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 0.5rem;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  #article-container .leading-relaxed {
    line-height: 1.8;
    text-align: justify;
    hyphens: auto;
  }

  /* 段落间间距 */
  .mb-4 {
    margin-bottom: 1.5rem;
  }

  /* 单词间距优化 */
  .inline-block {
    margin-right: 0.2rem;
    margin-left: 0.1rem;
  }

  /* 暗色模式适配 */
  @media (prefers-color-scheme: dark) {
    #article-container {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    }
  }

  /* 响应式排版 */
  @media (max-width: 640px) {
    #article-container {
      padding: 0.75rem;
      font-size: 1rem;
    }

    .text-lg {
      font-size: 1.125rem;
    }
  }
</style>
