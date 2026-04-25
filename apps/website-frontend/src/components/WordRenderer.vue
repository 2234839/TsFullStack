<template>
  <span
    :data-word-index="index"
    :class="className"
    :style="style"
    @mousedown="handleMouseDown"
    @touchstart="handleMouseDown"
    :title="titleText">
    {{ word }}
    <span
      v-if="memoryLevel > 0"
      class="absolute -bottom-3 left-1/2 transform -translate-x-1/2 text-[9px] opacity-40 group-hover:opacity-80 pointer-events-none"
      :style="{ color }"></span>
    <span
      v-if="isKeyWord"
      class="absolute -top-1 -right-1 text-xs opacity-70 pointer-events-none">
      ⭐
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { getMemoryColor } from '@/utils/format'

const { t } = useI18n()

interface Props {
  word: string
  index: number
  isKeyWord?: boolean
  memoryLevel?: number
  isClicked?: boolean
  isSelected?: boolean
  isHighlighted?: boolean
}

const { word, index, isKeyWord = false, memoryLevel = 0, isClicked = false, isSelected = false, isHighlighted = false } = defineProps<Props>()

const emit = defineEmits<{
  wordMouseDown: [e: MouseEvent | TouchEvent, index: number]
}>()

const color = computed(() => getMemoryColor(memoryLevel ?? 0))

const className = computed(() => {
  let base = 'cursor-pointer transition-colors duration-200 rounded relative group select-none inline-block px-1 py-0'

  if (isHighlighted) {
    base += ' bg-white dark:bg-primary-900 font-bold text-primary-800 dark:text-primary-200 border-2 border-primary-200 dark:border-primary-700 word-highlight'
  } else if (isSelected) {
    base += ' bg-primary-100 dark:bg-primary-800 font-medium word-selected'
  } else if (isClicked) {
    base += ' bg-primary-50/40 dark:bg-primary-800/40'
  }

  if (isKeyWord) {
    base += ' font-medium'
  }

  return base
})

const titleText = computed(() => {
  const level = memoryLevel ?? 0
  let text = `${word}: ${level}/10`

  if (isClicked) text += ` (${t('已操作')})`
  if (isKeyWord) text += ` (${t('关键词')})`
  if (isHighlighted) text += ` (${t('当前选中')})`

  return text
})

const style = computed(() => ({
  borderBottom: `1px solid ${color.value}`,
  lineHeight: '1.6',
  display: 'inline-block',
  margin: '1px 0',
}))

const handleMouseDown = (e: MouseEvent | TouchEvent) => {
  emit('wordMouseDown', e, index)
}
</script>

<style scoped>
.custom-highlight-pulse {
  animation: highlight-pulse 1.5s ease-in-out infinite alternate;
}

.word-highlight::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: color-mix(in srgb, var(--color-warning-500) 30%, transparent);
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
  background: color-mix(in srgb, var(--color-primary-500) 20%, transparent);
  border-radius: 3px;
  z-index: -1;
}

@keyframes highlight-pulse {
  0% {
    transform: scale(1);
    filter: brightness(1);
  }
  100% {
    transform: scale(1.02);
    filter: brightness(1.2);
  }
}
</style>