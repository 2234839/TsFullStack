import { computed, ref } from 'vue';
import { useAsyncState } from '@vueuse/core';

export interface WordData {
  /** 单词原文 */
  word: string;
  /** 记忆等级 */
  memoryLevel: number;
  /** 点击次数 */
  clickCount: number;
  /** 最后点击时间戳 */
  lastClickTime: number;
  /** 词频 */
  frequency: number;
  /** 翻译列表 */
  translations: string[];
  /** 总出现次数 */
  totalAppearances: number;
  /** 总学习会话数 */
  totalSessions: number;
  /** AI翻译 */
  aiTranslation?: string;
  /** 难度系数 */
  difficulty?: number;
  /** 例句列表 */
  examples?: string[];
  /** 语法信息 */
  grammar?: string;
  /** 发音信息 */
  pronunciation?: string;
}

export function useAiEnglishData() {
  const wordsData = ref<Record<string, WordData>>({});

  const remoteWordsData = useAsyncState(async (wordList: string[]) => {
    return getWordsData(wordList);
  }, {} as Record<string, WordData>);

  const words = computed(() => Object.values(remoteWordsData.state.value));

  async function getWordsData(wordList: string[]): Promise<Record<string, WordData>> {
    const wordsToLoad: string[] = [];

    wordList.forEach((word) => {
      const lowerWord = word.toLowerCase();
      if (remoteWordsData.state.value[lowerWord]) {
        wordsData.value[lowerWord] = remoteWordsData.state.value[lowerWord];
      } else {
        wordsToLoad.push(lowerWord);
      }
    });

    if (wordsToLoad.length > 0) {
      const loadedBatch = await StorageService.loadWords(wordsToLoad);
      Object.assign(wordsData.value, loadedBatch);

      wordsToLoad.forEach(word => {
        if (!loadedBatch[word]) {
          wordsData.value[word] = {
            word,
            memoryLevel: 0,
            clickCount: 0,
            lastClickTime: 0,
            frequency: 0,
            translations: [],
            totalAppearances: 0,
            totalSessions: 0
          };
        }
      });
    }
    return wordsData.value;
  }

  function getWordData(word: string): WordData | undefined {
    return wordsData.value[word.toLowerCase()];
  }

  async function updateWordDatas(words: WordData[]) {
    words.forEach((word) => {
      wordsData.value[word.word.toLowerCase()] = word;
    });
    await StorageService.saveWords(words);
  }

  return { words, wordsData, remoteWordsData, getWordData, getWordsData, updateWordDatas };
}

export class StorageService {
  private static LOCAL_STORAGE_KEY = 'english-learning-words';
  private static isLoggedIn = ref(false);

  static async saveWords(words: WordData[]): Promise<void> {
    if (this.isLoggedIn.value) {
      await this.saveWordsToRemote(words);
    } else {
      this.saveWordsToLocal(words);
    }
  }

  static async loadWords(words: string[]): Promise<Record<string, WordData>> {
    return this.isLoggedIn.value ? this.loadWordsFromRemote(words) : this.loadWordsFromLocal(words);
  }

  private static saveWordsToLocal(words: WordData[]): void {
    try {
      const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      const wordsMap: Record<string, WordData> = stored ? JSON.parse(stored) : {};
      words.forEach((word) => {
        wordsMap[word.word] = word;
      });
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(wordsMap));
    } catch (error) {
      console.error('保存到本地存储失败:', error);
    }
  }

  private static async saveWordsToRemote(words: WordData[]): Promise<void> {
    try {
      await fetch('/api/words/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(words),
      });
    } catch (error) {
      console.error('保存到远程数据库失败:', error);
    }
  }

  private static loadWordsFromLocal(words: string[]): Record<string, WordData> {
    try {
      const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (!stored) return {};

      const data = JSON.parse(stored);
      const result: Record<string, WordData> = {};
      words.forEach((word) => {
        const wordData = data[word];
        if (wordData) {
          if (wordData.memoryLevel > 10) {
            wordData.memoryLevel = Math.round(wordData.memoryLevel / 100);
          }
          result[word] = wordData;
        }
      });
      return result;
    } catch (error) {
      console.error('从本地存储加载失败:', error);
      return {};
    }
  }

  private static async loadWordsFromRemote(words: string[]): Promise<Record<string, WordData>> {
    try {
      const response = await fetch(`/api/words/batch?words=${encodeURIComponent(words.join(','))}`);
      if (!response.ok) return {};
      return await response.json();
    } catch (error) {
      console.error('从远程数据库加载失败:', error);
      return {};
    }
  }

  static setLoginStatus(loggedIn: boolean): void {
    this.isLoggedIn.value = loggedIn;
  }
}
