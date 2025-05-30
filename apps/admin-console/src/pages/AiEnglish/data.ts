import { ref } from 'vue';

// 类型定义
export interface WordData {
  word: string;
  memoryLevel: number;
  clickCount: number;
  lastClickTime: number;
  frequency: number;
  translations: string[];
  totalAppearances: number;
  totalSessions: number;
  aiTranslation?: string;
  difficulty?: number;
  examples?: string[];
  grammar?: string;
  pronunciation?: string;
}

export function useAiEnglishData() {
  const words = ref<WordData[]>([]);

  const getWordData = (word: string): WordData | undefined => {
    return words.value.find((w) => w.word === word.toLowerCase());
  };
  return { words, getWordData };
}
