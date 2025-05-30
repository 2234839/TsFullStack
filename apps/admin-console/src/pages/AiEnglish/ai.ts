import { useAiEnglishData, type WordData } from './data';

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

      const prompt = `请将以下中文翻译中的指定单词替换回英文原词：
中文翻译：${translatedText}
英文原文：${originalText}
需要保持英文的单词：${familiarWords.join(', ')}

要求：
1. 只替换指定的单词为英文
2. 保持句子的语法正确和流畅
3. 其他词汇保持中文
4. 直接返回混合后的结果`;

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
