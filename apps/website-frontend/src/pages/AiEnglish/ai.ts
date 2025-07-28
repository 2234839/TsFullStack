import { type WordData } from './data';

export interface AIAnalysis {
  articleDifficulty: number;
  suggestedStudyTime: number;
  keyWords: string[];
  learningTips: string[];
}

export interface WordAnalysis {
  translation: string;
  difficulty: number;
  examples: string[];
  grammar: string;
  pronunciation: string;
}

// AI 配置 - 使用环境变量避免硬编码
const AI_CONFIG = {
  model: 'GLM-4-Flash',
  apiBase: 'https://open.bigmodel.cn/api/paas/v4',
  get apiKey() {
    return import.meta.env.VITE_AI_API_KEY || '09bc63119e1f26d148cac77cda12e089.Rw7lnq1zkg3FcmYZ';
  },
};

// 统一的 AI 请求函数
export async function fetchAI(prompt: string): Promise<any> {
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
        temperature: 0.1, // 降低随机性提高一致性
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AI请求失败:', error);
    throw error;
  }
}

// 统一的JSON解析函数
export async function callAiResponseJSON(prompt: string): Promise<any> {
  const data = await fetchAI(prompt);
  const content = data.choices[0].message.content;
  return JSON_parse_AIResponse(content);
}

// 批量单词分析 - 一次请求分析多个单词
export const analyzeWordsBatch = async (
  words: { word: string; context?: string }[]
): Promise<Record<string, WordAnalysis>> => {
  if (words.length === 0) return {};

  const prompt = `作为英语词汇专家，请批量分析以下${words.length}个英文单词，每个单词提供完整的学习信息：

${words.map(({ word, context }, index) =>
  `${index + 1}. "${word}"${context ? ` (句子:"${context}")` : ''}`
).join('\n')}

对每个单词返回以下信息：
- translation: 精准简洁的中文翻译
- difficulty: 难度等级(1-10，基于CEFR标准)
- examples: 2个实用英文例句
- grammar: 核心语法信息(词性、用法)
- pronunciation: 标准音标

请按以下JSON格式返回：
{
  "单词1": {"translation":"","difficulty":0,"examples":[],"grammar":"","pronunciation":""},
  "单词2": {"translation":"","difficulty":0,"examples":[],"grammar":"","pronunciation":""}
}`;

  try {
    const result = await callAiResponseJSON(prompt);
    return result;
  } catch {
    // 如果批量失败，回退到单个分析
    const results: Record<string, WordAnalysis> = {};
    for (const { word } of words) {
      results[word] = {
        translation: '分析失败',
        difficulty: 5,
        examples: [],
        grammar: '',
        pronunciation: '',
      };
    }
    return results;
  }
};

// 单个单词分析（使用批量优化）
export const translateWithAI = async (
  word: string,
  context?: string,
): Promise<WordAnalysis> => {
  const results = await analyzeWordsBatch([{ word, context }]);
  return results[word] || {
    translation: '翻译服务暂时不可用',
    difficulty: 5,
    examples: [],
    grammar: '',
    pronunciation: '',
  };
};

// 批量段落翻译 - 一次请求翻译多个段落
export const translateParagraphsBatch = async (
  paragraphs: string[]
): Promise<string[]> => {
  if (paragraphs.length === 0) return [];

  const prompt = `作为专业翻译，请批量翻译以下${paragraphs.length}个英文段落：

${paragraphs.map((text, index) =>
  `段落${index + 1}: "${text}"`
).join('\n\n')}

翻译要求：
1. 准确流畅，保持原文语境
2. 按顺序返回翻译结果
3. 每个翻译单独一行，用"===段落X==="标记
4. 不要添加解释或说明

示例输出：
===段落1===
翻译结果1
===段落2===
翻译结果2`;

  try {
    const data = await fetchAI(prompt);
    const content = data.choices[0].message.content;

    // 解析批量翻译结果
    const translations: string[] = [];
    const regex = /===段落(\d+)===\s*([^=]+)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const index = parseInt(match[1]) - 1;
      translations[index] = match[2].trim();
    }

    // 确保返回所有段落的翻译
    return paragraphs.map((_, i) => translations[i] || '翻译服务暂时不可用');
  } catch {
    return paragraphs.map(() => '翻译服务暂时不可用');
  }
};

// 单个段落翻译（使用批量优化）
export const translateParagraphWithAI = async (text: string): Promise<string> => {
  const results = await translateParagraphsBatch([text]);
  return results[0];
};

export const analyzeArticleWithAI = async (text: string): Promise<AIAnalysis> => {
  const prompt = `作为英语教学专家，请全面分析以下英文文章的学习特征：

"${text}"

请提供结构化分析：
1. 文章难度评级（1-10）：基于CEFR标准，考虑词汇复杂度、句式结构、主题深度
2. 建议学习时间（分钟）：包含阅读、词汇学习、理解验证的时间分配
3. 关键词汇（5个）：选择最具学习价值的核心词汇
4. 学习建议（3条）：针对文章特点的具体学习策略

请严格按以下JSON格式返回：
{
  "articleDifficulty": 7,
  "suggestedStudyTime": 25,
  "keyWords": ["vocabulary1", "vocabulary2", "vocabulary3", "vocabulary4", "vocabulary5"],
  "learningTips": ["specific tip 1", "specific tip 2", "specific tip 3"]
}`;

  try {
    return await callAiResponseJSON(prompt);
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

      const prompt = `作为专业翻译，请根据熟悉词汇生成混合翻译：

英文原文："${originalText}"
中文翻译："${translatedText}"
熟悉词汇：[${familiarWords.join(', ')}]

规则：
1. 熟悉词汇保留英文，其余用中文翻译
2. 按英文原顺序排列
3. 省略无实义的虚词(the, a, an, to, in, on, at, for, of)
4. 直接输出结果，不要解释

示例：
原文：The cat sleeps on the sofa
翻译：猫在沙发上睡觉
熟悉：cat
输出：cat 在沙发上睡觉`;

      const data = await fetchAI(prompt);
      return data.choices[0].message.content.trim();
    } catch {
      return translatedText;
    }
  };
}
export function JSON_parse_AIResponse(resStr: string) {
  let jsonStr;
  try {
    // 如果ai输出的是markdown 代码块形式的json，这里去除掉外层的代码块符号
    if (resStr.startsWith('```')) {
      const lines = resStr.trim().split('\n');
      lines[0] = '';
      lines[lines.length - 1] = '';
      jsonStr = lines.join('\n').trim();
    } else {
      jsonStr = resStr.trim();
    }
    const jsonObj = JSON.parse(jsonStr);
    return jsonObj;
  } catch (error: unknown) {
    throw error as Error;
  }
}
