import {
  IndexedDBStorageStrategy,
  LocalStorageStrategy,
  StorageRepository,
  WordDataStrategy,
} from '@/utils/storage.repository';
import { computed, ref } from 'vue';

export interface WordData {
  /** 单词原文 */
  word: string;
  /** 记忆等级 (掌握度 0-10) */
  memoryLevel: number;
  /** 点击次数 */
  clickCount: number;
  /** 最后点击时间戳 */
  lastClickTime: Date;
  /** 眼熟度 (0-100, 基于见面次数和时间衰减) */
  familiarity: number;
  /** 翻译列表 */
  translations: string[];
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

// 创建存储库实例
const storageRepo = new StorageRepository({
  strategies: [new WordDataStrategy(), new IndexedDBStorageStrategy(), new LocalStorageStrategy()],
  bucket: 'ai-english',
});

export function useAiEnglishData() {
  const wordsData = ref<Record<string, WordData>>({});

  const words = computed(() => Object.values(wordsData.value));

  async function getWordsData(wordList: string[]): Promise<Record<string, WordData>> {
    const wordsToLoad: string[] = [];

    for (const word of wordList) {
      const lowerWord = word.toLowerCase();
      if (!wordsData.value[lowerWord]) {
        wordsToLoad.push(lowerWord);
      }
    }

    if (wordsToLoad.length > 0) {
      const loadedBatch = await StorageService.loadWords(wordsToLoad);
      Object.assign(wordsData.value, loadedBatch);

      wordsToLoad.forEach((word) => {
        if (!loadedBatch[word]) {
          wordsData.value[word] = {
            word,
            memoryLevel: 0,
            clickCount: 0,
            lastClickTime: new Date(),
            familiarity: 0,
            translations: [],
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

  return { words, wordsData, getWordData, getWordsData, updateWordDatas };
}

export class StorageService {
  private static word2key(word: WordData) {
    return StorageService.wordString2key(word.word);
  }
  private static wordString2key(word: string) {
    return word.toLowerCase();
  }
  static async saveWords(words: WordData[]): Promise<void> {
    storageRepo.saveBatch(
      words.map((word) => ({ key: StorageService.word2key(word), data: word })),
    );
  }

  static async loadWords(words: string[]): Promise<Record<string, WordData>> {
    return await storageRepo.loadBatch(words.map((word) => StorageService.wordString2key(word)));
  }
}
