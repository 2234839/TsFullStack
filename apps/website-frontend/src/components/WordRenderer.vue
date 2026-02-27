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

interface Props {
  word: string
  index: number
  isKeyWord?: boolean
  memoryLevel?: number
  isClicked?: boolean
  isSelected?: boolean
  isHighlighted?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isKeyWord: false,
  memoryLevel: 0,
  isClicked: false,
  isSelected: false,
  isHighlighted: false
})

const emit = defineEmits<{
  wordMouseDown: [e: MouseEvent | TouchEvent, index: number]
}>()

const color = computed(() => {
  // 使用与原来相同的渐变色逻辑
  const level = props.memoryLevel || 0
  const normalizedLevel = Math.max(0, Math.min(10, level));
  const ratio = normalizedLevel / 10;

  if (ratio < 0.5) {
    return `rgb(255, ${Math.round(255 * (ratio * 2))}, 0)`;
  } else {
    return `rgb(${Math.round(255 * (2 - ratio * 2))}, 255, 0)`;
  }
})

const className = computed(() => {
  let base = 'cursor-pointer transition-colors duration-200 rounded relative group select-none inline-block px-1 py-0'

  if (props.isHighlighted) {
    base += ' bg-white font-bold text-gray-800 border-2 border-gray-200 word-highlight'
  } else if (props.isSelected) {
    base += ' bg-blue-100 font-medium word-selected'
  } else if (props.isClicked) {
    base += ' bg-blue-50/40'
  }

  if (props.isKeyWord) {
    base += ' font-medium'
  }

  return base
})

const titleText = computed(() => {
  const level = props.memoryLevel || 0
  let text = `${props.word}: ${level}/10`

  if (props.isClicked) text += ' (已操作)'
  if (props.isKeyWord) text += ' (关键词)'
  if (props.isHighlighted) text += ' (当前选中)'

  return text
})

const style = computed(() => ({
  borderBottom: `1px solid ${color.value}`,
  lineHeight: '1.6',
  display: 'inline-block',
  margin: '1px 0',
}))

const handleMouseDown = (e: MouseEvent | TouchEvent) => {
  emit('wordMouseDown', e, props.index)
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