import { type WordData } from './data';

export interface AIAnalysis {
  articleDifficulty: number;
  suggestedStudyTime: number;
  keyWords: string[];
  learningTips: string[];
}

// AI 配置
const AI_CONFIG = {
  model: 'GLM-4-Flash',
  apiBase: 'https://open.bigmodel.cn/api/paas/v4',
  apiKey: '09bc63119e1f26d148cac77cda12e089.Rw7lnq1zkg3FcmYZ',
};

// AI 交互函数
async function fetchAI(prompt: string) {
  try {
    const response = await fetch(`${AI_CONFIG.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) throw new Error(`API请求失败: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('AI请求失败:', error);
    throw error;
  }
}

export const translateWithAI = async (
  word: string,
  context?: string,
): Promise<{
  translation: string;
  difficulty: number;
  examples: string[];
  grammar: string;
  pronunciation: string;
}> => {
  const prompt = `请分析英文单词 "${word}"${
    context ? ` (在句子"${context}"中)` : ''
  }，并提供以下信息：
1. 中文翻译（简洁准确）
2. 难度等级（1-10，1最简单，10最难）
3. 2个实用例句（英文）
4. 语法信息（词性、用法）
5. 音标

请按以下JSON格式返回：
{
  "translation": "中文翻译",
  "difficulty": 难度数字,
  "examples": ["例句1", "例句2"],
  "grammar": "语法信息",
  "pronunciation": "音标"
}`;

  try {
    const data = await fetchAI(prompt);
    const content = data.choices[0].message.content;

    try {
      return JSON.parse(content);
    } catch {
      const translationMatch = content.match(/翻译[：:]\s*([^\n]+)/);
      return {
        translation: translationMatch?.[1] || content.slice(0, 50),
        difficulty: 5,
        examples: [],
        grammar: '',
        pronunciation: '',
      };
    }
  } catch {
    return {
      translation: '翻译服务暂时不可用',
      difficulty: 5,
      examples: [],
      grammar: '',
      pronunciation: '',
    };
  }
};

export const translateParagraphWithAI = async (text: string): Promise<string> => {
  const prompt = `请将以下英文段落翻译成中文，要求：
1. 翻译准确、流畅、自然
2. 保持原文的语气和风格
3. 直接返回翻译结果，不要其他说明

英文原文：
"${text}"`;

  try {
    const data = await fetchAI(prompt);
    return data.choices[0].message.content.trim();
  } catch {
    return '段落翻译服务暂时不可用';
  }
};

export const analyzeArticleWithAI = async (text: string): Promise<AIAnalysis> => {
  const prompt = `请分析以下英文文章的学习特征：

"${text}"

请提供以下分析：
1. 文章整体难度（1-10）
2. 建议学习时间（分钟）
3. 5个关键词汇
4. 3个学习建议

请按以下JSON格式返回：
{
  "articleDifficulty": 难度数字,
  "suggestedStudyTime": 时间数字,
  "keyWords": ["词汇1", "词汇2", "词汇3", "词汇4", "词汇5"],
  "learningTips": ["建议1", "建议2", "建议3"]
}`;

  try {
    const data = await fetchAI(prompt);
    const content = data.choices[0].message.content;

    try {
      return JSON.parse(content);
    } catch {
      return {
        articleDifficulty: 5,
        suggestedStudyTime: 15,
        keyWords: [],
        learningTips: ['AI分析暂时不可用'],
      };
    }
  } catch {
    return {
      articleDifficulty: 5,
      suggestedStudyTime: 15,
      keyWords: [],
      learningTips: ['AI分析服务暂时不可用'],
    };
  }
};

export function useCreateMixedTranslation({
  getWordData,
}: {
  getWordData: (word: string) => WordData | undefined;
}) {
  return async (
    originalText: string,
    translatedText: string,
    wordsInSelection: string[],
  ): Promise<string> => {
    try {
      // 获取熟悉的单词
      const familiarWords = wordsInSelection.filter((word) => {
        const wordData = getWordData(word);
        return wordData && wordData.memoryLevel >= 7;
      });
      if (familiarWords.length === 0) return translatedText;

      const prompt = `# 英文学习辅助翻译器
## 核心规则
1. 严格按英文原文单词顺序输出混合翻译
2. **熟悉的单词保持英文原词**（不改变大小写）
3. 不熟悉的单词使用中文翻译
4. 最终输出只能是混合字符串（无原文/无完整翻译）
5. 单词间用空格分隔（保留原标点）

## 错误示例（禁止输出）
× "I like to play with my friends 我喜欢和朋友们一起玩"
× "I like 和 my friends 玩"
✓ 正确形式："i 喜欢 和 my 朋友们 一起玩"

## 处理流程
1. 拆分英文原文为单词列表：["i", "like", "to", "play", "with", "my", "friends"]
2. 标记熟悉单词：i✅, my✅
3. 替换不熟悉单词：like→喜欢, to→(忽略虚词), play→玩, with→和, friends→朋友们
4. 按原顺序拼接：i + 喜欢 + 和 + my + 朋友们 + 一起玩

## 标准示例
英文原文：Hello world
中文翻译：你好 世界
熟悉单词：Hello
→ Hello 世界

英文原文：She eats an apple
中文翻译：她吃了一个苹果
熟悉单词：She
→ She 吃了一个 苹果

--- 待处理数据 ---
英文原文：${originalText}
中文翻译：${translatedText}
熟悉单词：${familiarWords.join(', ')}`;

      const response = await fetch(`${AI_CONFIG.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AI_CONFIG.apiKey}`,
        },
        body: JSON.stringify({
          model: AI_CONFIG.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
      });

      return response.ok
        ? (await response.json()).choices[0].message.content.trim()
        : translatedText;
    } catch {
      return translatedText;
    }
  };
}
