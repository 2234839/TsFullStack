<template>
  <div class="text-lg leading-relaxed flex flex-wrap gap-1 items-center">
    <!-- 渲染一行中的所有单词 -->
    <template v-for="(token, tokenIndex) in tokens" :key="tokenIndex">
      <WordRenderer
        v-if="renderToken(token, tokenIndex).isWord"
        :word="renderToken(token, tokenIndex).word!"
        :index="wordIndexMap[tokenIndex]!"
        :isKeyWord="renderToken(token, tokenIndex).isKeyWord"
        :memoryLevel="renderToken(token, tokenIndex).memoryLevel"
        :isClicked="renderToken(token, tokenIndex).isClicked"
        :isSelected="renderToken(token, tokenIndex).isSelected"
        :isHighlighted="renderToken(token, tokenIndex).isHighlighted"
        @wordMouseDown="handleWordMouseDown"
      />
      <span
        v-else
        class="select-none"
        :style="{ lineHeight: '1.6' }"
      >
        {{ token }}
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import WordRenderer from './WordRenderer.vue'

interface Props {
  line: string
  lineStartWordIndex: number
  currentParagraphKeyWords: string[]
  getWordData: (word: string) => any
  currentSession: any
  selectionState: any
  highlightedWordIndex: number
  aiAnalysis: any
}

const props = defineProps<Props>()

const emit = defineEmits<{
  wordMouseDown: [e: MouseEvent | TouchEvent, index: number]
}>()

// 按正则表达式分割行文本
const tokens = computed(() => props.line.split(/(\s+|[^\w\s])/))

// 计算单词索引映射
const wordIndexMap = computed(() => {
  const map: number[] = []
  let currentWordIndex = props.lineStartWordIndex

  tokens.value.forEach((token, index) => {
    const cleanWord = token.toLowerCase().replace(/[^\w]/g, '')
    if (cleanWord && /^\w+$/.test(cleanWord) && props.getWordData?.(cleanWord)) {
      map[index] = currentWordIndex++
    }
  })

  return map
})

// 渲染每个token的信息
const renderToken = (token: string, tokenIndex: number) => {
  const cleanWord = token.toLowerCase().replace(/[^\w]/g, '')
  const wordData = props.getWordData?.(cleanWord)

  if (!cleanWord || !/^\w+$/.test(cleanWord) || !wordData) {
    return { isWord: false }
  }

  const isKeyWord = props.aiAnalysis?.value?.keyWords?.includes(cleanWord) ||
                   props.currentParagraphKeyWords.includes(cleanWord)
  const isClicked = props.currentSession?.clickedWords?.has(cleanWord) || false
  const isSelected = props.selectionState?.selectedWords?.has(wordIndexMap.value[tokenIndex]) || false
  const isHighlighted = props.highlightedWordIndex === wordIndexMap.value[tokenIndex]

  return {
    isWord: true,
    word: cleanWord,
    isKeyWord,
    memoryLevel: wordData.memoryLevel || 0,
    isClicked,
    isSelected,
    isHighlighted
  }
}

const handleWordMouseDown = (e: MouseEvent | TouchEvent, index: number) => {
  emit('wordMouseDown', e, index)
}
</script>