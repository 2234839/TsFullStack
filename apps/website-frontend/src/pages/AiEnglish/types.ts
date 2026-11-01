/** 学习会话状态 */
export interface StudySession {
  /** 已点击的单词集合 */
  clickedWords: Set<string>;
  /** 会话开始时间戳 */
  startTime: number;
}

/** 选择状态 */
export interface SelectionState {
  /** 是否正在选择 */
  isSelecting: boolean;
  /** 起始单词索引 */
  startWordIndex: number;
  /** 结束单词索引 */
  endWordIndex: number;
  /** 已选中的单词索引集合 */
  selectedWords: Set<number>;
}

/** 段落数据 */
export interface ParagraphData {
  id: number;
  text: string;
  words: string[];
  isCompleted: boolean;
  completedAt?: number;
  reason?: string;
  complexity?: number;
  estimatedReadingTime?: number;
  keyVocabulary?: string[];
}

/** 段落翻译结果 */
export interface ParagraphTranslation {
  originalText: string;
  translatedText: string;
  mixedTranslation: string;
  wordsInSelection: string[];
}
