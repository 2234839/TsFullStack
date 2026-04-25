<template>
  <div class="text-lg leading-relaxed flex flex-wrap gap-1 items-center">
    <!-- 渲染一行中的所有单词 -->
    <template v-for="(info, tokenIndex) in tokenRenderInfos" :key="tokenIndex">
      <WordRenderer
        v-if="info.isWord"
        :word="info.word!"
        :index="wordIndexMap[tokenIndex] ?? 0"
        :isKeyWord="info.isKeyWord"
        :memoryLevel="info.memoryLevel"
        :isClicked="info.isClicked"
        :isSelected="info.isSelected"
        :isHighlighted="info.isHighlighted"
        @wordMouseDown="handleWordMouseDown"
      />
      <span
        v-else
        class="select-none leading-relaxed"
      >
        {{ tokens[tokenIndex] }}
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import WordRenderer from './WordRenderer.vue'
import type { WordData } from '@/pages/AiEnglish/data'
import type { StudySession, SelectionState, AIAnalysis } from '@/pages/AiEnglish/types'

interface Props {
  line: string
  lineStartWordIndex: number
  currentParagraphKeyWords: string[]
  getWordData: (word: string) => WordData | undefined
  currentSession: StudySession
  selectionState: SelectionState
  highlightedWordIndex: number
  aiAnalysis: AIAnalysis | null
}

/** 单词渲染信息 */
interface TokenRenderInfo {
  isWord: boolean
  word?: string
  isKeyWord?: boolean
  memoryLevel?: number
  isClicked?: boolean
  isSelected?: boolean
  isHighlighted?: boolean
}

const { line, lineStartWordIndex, currentParagraphKeyWords, getWordData, currentSession, selectionState, highlightedWordIndex, aiAnalysis } = defineProps<Props>()

const emit = defineEmits<{
  wordMouseDown: [e: MouseEvent | TouchEvent, index: number]
}>()

/** 按正则表达式分割行文本 */
const tokens = computed(() => line.split(/(\s+|[^\w\s])/))

/** 计算单词索引映射 */
const wordIndexMap = computed(() => {
  const map: number[] = []
  let currentWordIndex = lineStartWordIndex

  tokens.value.forEach((token, index) => {
    const cleanWord = token.toLowerCase().replace(/[^\w]/g, '')
    if (cleanWord && /^\w+$/.test(cleanWord) && getWordData?.(cleanWord)) {
      map[index] = currentWordIndex++
    }
  })

  return map
})

/** 预计算所有 token 的渲染信息，避免模板中重复调用 */
const tokenRenderInfos = computed<TokenRenderInfo[]>(() =>
  tokens.value.map((token, tokenIndex) => renderToken(token, tokenIndex))
)

/** 渲染每个token的信息 */
const renderToken = (token: string, tokenIndex: number): TokenRenderInfo => {
  const cleanWord = token.toLowerCase().replace(/[^\w]/g, '')
  const wordData = getWordData?.(cleanWord)

  if (!cleanWord || !/^\w+$/.test(cleanWord) || !wordData) {
    return { isWord: false }
  }

  const isKeyWord = aiAnalysis?.keyWords?.includes(cleanWord) ||
                   currentParagraphKeyWords.includes(cleanWord)
  const isClicked = currentSession.clickedWords.has(cleanWord)
  const isSelected = selectionState.selectedWords.has(wordIndexMap.value[tokenIndex])
  const isHighlighted = highlightedWordIndex === wordIndexMap.value[tokenIndex]

  return {
    isWord: true,
    word: cleanWord,
    isKeyWord,
    memoryLevel: wordData.memoryLevel ?? 0,
    isClicked,
    isSelected,
    isHighlighted
  }
}

const handleWordMouseDown = (e: MouseEvent | TouchEvent, index: number) => {
  emit('wordMouseDown', e, index)
}
</script>