<template>
  <div class="space-y-4">
    <!-- 段落复杂度指示器 -->
    <div v-if="complexity > 7" class="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
      <i class="pi pi-exclamation-triangle"></i>
      <span>较高难度段落 • 建议仔细阅读</span>
    </div>

    <!-- 段落文本 - 处理换行和格式 -->
    <div class="leading-relaxed text-lg">
      <div class="space-y-2">
        <!-- 按行分割文本，保留换行结构 -->
        <div v-for="(line, lineIndex) in lines" :key="lineIndex" class="mb-4 last:mb-0">
          <template v-if="line.trim().length === 0">
            <!-- 空行渲染为换行 -->
            <br />
          </template>
          <template v-else>
            <!-- 渲染有内容的行 -->
            <LineRenderer
              :line="line"
              :lineStartWordIndex="lineStartIndices[lineIndex]!"
              :currentParagraphKeyWords="currentParagraphKeyWords"
              :getWordData="getWordData"
              :currentSession="currentSession"
              :selectionState="selectionState"
              :highlightedWordIndex="highlightedWordIndex"
              :aiAnalysis="aiAnalysis"
              @wordMouseDown="handleWordMouseDown"
            />
          </template>
        </div>
      </div>
    </div>

    <!-- 段落信息 -->
    <div v-if="showParagraphInfo" class="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
      <span>字数: {{ text.split(/\s+/).length }}</span>
      <span v-if="estimatedReadingTime">预计阅读: {{ Math.ceil((estimatedReadingTime || 0) / 60) }}分钟</span>
      <span v-if="complexity">复杂度: {{ complexity }}/10</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LineRenderer from './LineRenderer.vue'

interface Props {
  text: string
  currentParagraphKeyWords: string[]
  complexity?: number
  estimatedReadingTime?: number
  showParagraphInfo?: boolean
  onWordMouseDown: (e: MouseEvent | TouchEvent, index: number) => void
  getWordData: (word: string) => any
  currentSession: any
  selectionState: any
  highlightedWordIndex: number
  aiAnalysis: any
}

const props = withDefaults(defineProps<Props>(), {
  complexity: 5,
  estimatedReadingTime: 0,
  showParagraphInfo: true
})

// 按行分割文本，保留换行结构
const lines = computed(() => props.text.split('\n'))

// 计算每行的起始单词索引
const lineStartIndices = computed(() => {
  const indices: number[] = []
  let globalWordIndex = 0

  lines.value.forEach(line => {
    indices.push(globalWordIndex)

    // 计算当前行的单词数量，更新全局索引
    if (line.trim()) {
      const lineWords = line.split(/(\s+|[^\w\s])/)
        .filter(token => {
          const cleanWord = token.toLowerCase().replace(/[^\w]/g, '')
          return cleanWord && /^\w+$/.test(cleanWord)
        })
      globalWordIndex += lineWords.length
    }
  })

  return indices
})

const handleWordMouseDown = (e: MouseEvent | TouchEvent, index: number) => {
  props.onWordMouseDown(e, index)
}
</script>

<style scoped>
/* 段落排版优化 */
.leading-relaxed {
  line-height: 1.8;
  text-align: justify;
  hyphens: auto;
}

/* 段落间间距 */
.mb-4 {
  margin-bottom: 1.5rem;
}

/* 单词间距优化 */
:deep(.inline-block) {
  margin-right: 0.2rem;
  margin-left: 0.1rem;
}
</style>