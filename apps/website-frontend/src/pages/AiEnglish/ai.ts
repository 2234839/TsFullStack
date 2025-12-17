import { useOpenAIConfig } from '@/storage';
import { useAPI } from '@/api';
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
  definition?: string;
  synonyms?: string[];
  wordFamily?: string[];
  collocations?: string[];
  tips?: string;
}
const openAIConfig = useOpenAIConfig();
// 获取动态AI配置
const getAIConfig = () => ({
  model: openAIConfig.value.model || 'gpt-3.5-turbo',
  apiBase: openAIConfig.value.baseURL || 'https://api.openai.com/v1',
  apiKey: openAIConfig.value.apiKey || import.meta.env.VITE_AI_API_KEY || '',
  maxTokens: openAIConfig.value.maxTokens || 2000,
  temperature: openAIConfig.value.temperature || 0.1,
});

// 统一的 AI 请求函数 - 支持混合模式（用户配置优先，后台代理兜底）
export async function fetchAI(prompt: string, options?: {
  forceProxy?: boolean;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    };
  }>;
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
}) {
  const config = getAIConfig();
  const { API } = useAPI();

  // 构建基础请求
  const baseRequest = {
    model: config.model,
    messages: [{ role: 'user' as const, content: prompt }],
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    ...(options?.tools && { tools: options.tools }),
    ...(options?.tool_choice && { tool_choice: options.tool_choice }),
  };

  // 如果用户配置了API Key且不是强制使用代理，使用用户配置
  if (config.apiKey && !options?.forceProxy) {
    console.log('使用用户配置的AI服务');
    const response = await fetch(`${config.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(baseRequest),
    });

    if (!response.ok) {
      throw new Error(`用户配置API请求失败: ${response.status}`);
    }

    return await response.json();
  }

  // 使用后台代理
  const response = await API.aiApi.proxyOpenAI(baseRequest);
  console.log('后台代理响应:', response);

  // RPC 系统已经返回了正确类型的数据
  return response;
}

// 统一的JSON解析函数
export async function callAiResponseJSON(prompt: string) {
  const data = await fetchAI(prompt);
  const content = data.choices[0].message.content;
  return JSON_parse_AIResponse(content);
}


// 批量单词分析 - 使用 Function Calling
export const analyzeWordsBatch = async (
  words: { word: string; context?: string }[],
): Promise<Record<string, WordAnalysis>> => {
  if (words.length === 0) return {};

  const wordsList = words
    .map(
      ({ word, context }, index) =>
        `${index + 1}. "${word}"${context ? ` (句子:"${context}")` : ''}`,
    )
    .join('\n');

  const prompt = `作为英语词汇专家，请批量分析以下 ${words.length} 个英文单词：

${wordsList}

为每个单词提供完整的学习信息，包括：
- 最准确的中文翻译（1-8个字）
- 根据CEFR标准评级（A1=1, A2=2, B1=4, B2=6, C1=8, C2=10）
- 2个完整的英文例句（包含上下文）
- 词性和基本用法（15-30字）
- 国际音标
- 英文释义
- 近义词
- 词族
- 常用搭配
- 学习提示`;

  // 创建 Function Calling 的参数 schema
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  words.forEach(({ word }) => {
    const wordProperties: Record<string, unknown> = {
      type: 'object',
      description: `${word} 的学习分析`,
      properties: {
        translation: { type: 'string', description: '中文翻译' },
        difficulty: { type: 'number', description: '难度等级(1-10)' },
        definition: { type: 'string', description: '英文释义' },
        examples: { type: 'array', items: { type: 'string' }, description: '例句' },
        grammar: { type: 'string', description: '词性和基本用法' },
        pronunciation: { type: 'string', description: '国际音标' },
        synonyms: { type: 'array', items: { type: 'string' }, description: '近义词' },
        wordFamily: { type: 'array', items: { type: 'string' }, description: '词族' },
        collocations: { type: 'array', items: { type: 'string' }, description: '搭配' },
        tips: { type: 'string', description: '学习提示' },
      },
      required: [
        'translation',
        'difficulty',
        'definition',
        'examples',
        'grammar',
        'pronunciation',
        'synonyms',
        'wordFamily',
        'collocations',
        'tips',
      ],
    };
    properties[word] = wordProperties;
    required.push(word);
  });

  const parametersSchema: Record<string, unknown> = {
    type: 'object',
    properties,
    required,
  };

  const result = await callAiWithFunctionCalling<Record<string, WordAnalysis>>(
    prompt,
    'analyzeWordsBatch',
    '批量分析英文单词的学习信息',
    parametersSchema,
  );

  if (result.success && result.data) {
    return result.data;
  }

  // 如果批量失败，回退到默认值而不是单个分析（避免额外的 API 调用）
  const results: Record<string, WordAnalysis> = {};
  for (const { word } of words) {
    results[word] = {
      translation: result.error || '分析失败',
      difficulty: 5,
      examples: [`分析 "${word}" 时出现错误，请稍后重试。`],
      grammar: '',
      pronunciation: '',
      definition: '',
      synonyms: [],
      wordFamily: [],
      collocations: [],
      tips: `批量分析 "${word}" 失败，建议稍后重新分析。`,
    };
  }
  return results;
};

// 单个单词分析（使用批量优化）
export const translateWithAI = async (word: string, context?: string): Promise<WordAnalysis> => {
  const results = await analyzeWordsBatch([{ word, context }]);
  return (
    results[word] || {
      translation: '翻译服务暂时不可用',
      difficulty: 5,
      examples: [],
      grammar: '',
      pronunciation: '',
    }
  );
};

// 批量段落翻译 - 一次请求翻译多个段落
export const translateParagraphsBatch = async (paragraphs: string[]): Promise<string[]> => {
  if (paragraphs.length === 0) return [];

  const prompt = `作为专业翻译，请批量翻译以下${paragraphs.length}个英文段落：

${paragraphs.map((text, index) => `段落${index + 1}: "${text}"`).join('\n\n')}

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
      const index = parseInt(match[1] || '') - 1;
      translations[index] = match[2]?.trim() || '';
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
  return results[0] || '';
};

export const analyzeArticleWithAI = async (text: string): Promise<AIAnalysis> => {
  const prompt = `作为英语教学专家，请全面分析以下英文文章的学习特征：

"${text}"

请提供结构化分析，评估文章的学习价值和难度，包括：
- 基于词汇复杂度、句式结构、主题深度的综合难度评级（1-10分）
- 合理估算阅读、词汇学习、理解验证所需时间（分钟）
- 筛选5个最有学习价值的核心词汇（排除过于简单或罕见的词汇）
- 提供3条具体、可操作的学习建议

评分标准：
- A1-A2 (1-3分): 简单词汇，基础句式，日常话题
- B1-B2 (4-7分): 中等词汇，复合句式，通用话题
- C1-C2 (8-10分): 高级词汇，复杂句式，专业话题`;

  // 创建 Function Calling 的参数 schema
  const parametersSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
      articleDifficulty: {
        type: 'number',
        description: '文章难度等级（1-10分）',
      },
      suggestedStudyTime: {
        type: 'number',
        description: '建议学习时间（分钟）',
      },
      keyWords: {
        type: 'array',
        items: { type: 'string' },
        description: '核心词汇列表',
      },
      learningTips: {
        type: 'array',
        items: { type: 'string' },
        description: '学习建议',
      },
    },
    required: ['articleDifficulty', 'suggestedStudyTime', 'keyWords', 'learningTips'],
  };

  const result = await callAiWithFunctionCalling<AIAnalysis>(
    prompt,
    'analyzeArticle',
    '分析英文文章的学习特征和难度',
    parametersSchema,
  );

  if (result.success && result.data) {
    return result.data;
  }

  // 分析失败时返回默认值
  return {
    articleDifficulty: 5,
    suggestedStudyTime: 15,
    keyWords: [],
    learningTips: [result.error || 'AI分析服务暂时不可用'],
  };
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

// 智能段落拆分接口定义
export interface SmartParagraph {
  text: string;
  reason: string; // 拆分原因
  complexity: number; // 复杂度 1-10
  estimatedReadingTime: number; // 预估阅读时间（秒）
  keyVocabulary: string[]; // 关键词汇
}

export interface SmartSegmentationResult {
  paragraphs: SmartParagraph[];
  totalSegments: number;
  estimatedTotalTime: number; // 总预估学习时间（分钟）
  segmentationStrategy: string; // 分段策略说明
}

// AI智能段落拆分功能
export const segmentArticleWithAI = async (text: string): Promise<SmartSegmentationResult> => {
  const prompt = `作为英语教学专家，请将以下英文文章智能拆分为适合学习的段落：

原文：
"${text}"

拆分要求：
1. 每个段落长度控制在50-150词，确保信息量适中
2. 保持语义完整性，不在句子中间拆分
3. 根据内容逻辑和主题转换进行分段
4. 考虑学习者的阅读耐心，复杂内容适当缩短
5. 为每个段落提供拆分理由和学习指导
6. 保持段落的原始文本格式，包括换行符

分析维度：
- 语义连贯性和主题边界
- 句式复杂度和词汇难度
- 信息密度和学习负荷
- 逻辑关系和论证结构

重要：返回的段落文本必须保持原始格式，包含正确的换行符。请返回结构化的分段结果，包括每个段落的详细分析。`;

  const parametersSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
      paragraphs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: '段落文本' },
            reason: { type: 'string', description: '拆分该段落的理由' },
            complexity: { type: 'number', description: '复杂度评级(1-10)' },
            estimatedReadingTime: { type: 'number', description: '预估阅读时间(秒)' },
            keyVocabulary: {
              type: 'array',
              items: { type: 'string' },
              description: '该段落的核心词汇(3-5个)'
            }
          },
          required: ['text', 'reason', 'complexity', 'estimatedReadingTime', 'keyVocabulary']
        },
        description: '智能分段结果'
      },
      totalSegments: { type: 'number', description: '总段落数' },
      estimatedTotalTime: { type: 'number', description: '总预估学习时间(分钟)' },
      segmentationStrategy: { type: 'string', description: '分段策略说明' }
    },
    required: ['paragraphs', 'totalSegments', 'estimatedTotalTime', 'segmentationStrategy']
  };

  const result = await callAiWithFunctionCalling<SmartSegmentationResult>(
    prompt,
    'segmentArticle',
    '智能拆分英文文章为学习段落',
    parametersSchema
  );

  if (result.success && result.data) {
    return result.data;
  }

  // AI分段失败时的回退方案
  const fallbackParagraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return {
    paragraphs: fallbackParagraphs.map((paragraph) => ({
      text: paragraph,
      reason: '默认分段（基于空行分隔）',
      complexity: 5,
      estimatedReadingTime: Math.ceil(paragraph.split(/\s+/).length * 0.3),
      keyVocabulary: []
    })),
    totalSegments: fallbackParagraphs.length,
    estimatedTotalTime: Math.ceil(fallbackParagraphs.length * 2),
    segmentationStrategy: '使用传统分段方式作为回退方案'
  };
};

// JSON 模式定义，用于生成 prompt 中的格式说明
interface JsonSchemaField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  example?: unknown;
  required?: boolean;
  items?: JsonSchemaField;
  properties?: Record<string, JsonSchemaField>;
}

// 生成 JSON 格式说明
function generateJsonFormatExample(schema: Record<string, JsonSchemaField>): string {
  const generateExample = (field: JsonSchemaField): unknown => {
    switch (field.type) {
      case 'string':
        return field.example || '';
      case 'number':
        return field.example || 0;
      case 'boolean':
        return field.example || false;
      case 'array':
        return field.example || [];
      case 'object':
        const obj: Record<string, unknown> = {};
        if (field.properties) {
          for (const [key, prop] of Object.entries(field.properties)) {
            obj[key] = generateExample(prop);
          }
        }
        return obj;
      default:
        return null;
    }
  };

  const example: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema)) {
    example[key] = generateExample(field);
  }

  return JSON.stringify(example, null, 2);
}

// 生成严格的 JSON 格式 prompt
function generateStrictJsonPrompt(
  schema: Record<string, JsonSchemaField>,
  additionalInstructions?: string,
): string {
  const formatExample = generateJsonFormatExample(schema);

  return `
📝 **重要：必须严格按照 JSON 格式返回**

请严格按照以下 JSON 格式返回数据，不要包含任何其他文字说明：

${formatExample}

**格式要求：**
- 返回纯 JSON 格式，不要用代码块包裹
- 所有字符串字段使用双引号
- 数组字段使用 []
- 对象字段使用 {}
- 数字不要用引号
- 布尔值用 true/false

${additionalInstructions || ''}

请直接返回 JSON，不要添加任何解释文字。`;
}

// 增强的 JSON 解析函数 - 支持多种容错机制
export function JSON_parse_AIResponse<T = unknown>(resStr: string): T {
  // 尝试直接解析
  try {
    return JSON.parse(resStr.trim());
  } catch (error) {
    // 尝试去除 markdown 代码块
    try {
      if (resStr.includes('```')) {
        const codeBlockMatch = resStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          const jsonStr = codeBlockMatch[1].trim();
          return JSON.parse(jsonStr);
        }
      }
    } catch (error) {
      // 继续下一个方法
    }

    // 尝试智能修复
    try {
      let repairedStr = resStr.trim();

      // 移除可能的前缀和后缀
      repairedStr = repairedStr.replace(/^[\s\S]*?(\{)/, '$1');
      repairedStr = repairedStr.replace(/(\})[\s\S]*?$/, '$1');

      // 修复常见的 JSON 格式问题
      repairedStr = repairedStr
        .replace(/'/g, '"') // 单引号转双引号
        .replace(/(\w+):/g, '"$1":') // 属性名加引号
        .replace(/:\s*([^",\[\]\{\}][^",\[\]\{\}]*?)\s*([,\]}])/g, ': "$1"$2') // 未加引号的字符串值
        .replace(/:\s*"([^"]*)\n([^"]*?)"/g, ': "$1 $2"'); // 修复换行问题

      return JSON.parse(repairedStr);
    } catch (error) {
      // 所有方法都失败，抛出错误
      throw new Error(`JSON解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}

// 带有格式验证的 AI 调用函数
export async function callAiWithStructuredResponse<T = unknown>(
  prompt: string,
  schema: Record<string, JsonSchemaField>,
  additionalInstructions?: string,
): Promise<{ success: boolean; data?: T; error?: string }> {
  // 添加格式说明到 prompt
  const formatPrompt = generateStrictJsonPrompt(schema, additionalInstructions);
  const fullPrompt = `${prompt}\n\n${formatPrompt}`;

  try {
    const data = await fetchAI(fullPrompt);
    const content = data.choices[0].message.content;
    const parsed = JSON_parse_AIResponse<T>(content);
    return { success: true, data: parsed };
  } catch (error) {
    // 重试一次，这次强调格式
    try {
      const retryPrompt = `${prompt}\n\n⚠️ **上一次响应格式不正确，请严格按照以下格式返回：**\n\n${formatPrompt}`;
      const retryData = await fetchAI(retryPrompt);
      const retryContent = retryData.choices[0].message.content;
      const retryParsed = JSON_parse_AIResponse<T>(retryContent);
      return { success: true, data: retryParsed };
    } catch (retryError) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'JSON解析失败',
      };
    }
  }
}

// 使用 Function Calling 的结构化 AI 调用函数
export async function callAiWithFunctionCalling<T = unknown>(
  prompt: string,
  functionName: string,
  functionDescription: string,
  parametersSchema: Record<string, unknown>,
): Promise<{ success: boolean; data?: T; error?: string }> {

  // 准备工具定义
  const tool = {
    type: 'function' as const,
    function: {
      name: functionName,
      description: functionDescription,
      parameters: parametersSchema,
    },
  };

  
  const response = await fetchAI(prompt, {
    tools: [tool],
    tool_choice: { type: 'function', function: { name: functionName } },
  });

  console.log('Function Calling响应:', response);

  // 检查是否有 tool_calls
  if (response.choices && response.choices[0]?.message?.tool_calls?.length > 0) {
    const toolCall = response.choices[0].message.tool_calls[0];
    if (toolCall.function.name === functionName) {
      const args = JSON.parse(toolCall.function.arguments);
      return { success: true, data: args as T };
    }
  }

  // 如果没有 tool_call，尝试解析普通内容
  if (response.choices && response.choices[0]?.message?.content) {
    try {
      const parsedData = JSON.parse(response.choices[0].message.content);
      if (parsedData && typeof parsedData === 'object') {
        return { success: true, data: parsedData as T };
      }
    } catch (error) {
      // 解析失败，继续下一步
    }
  }

  // 如果 Function Calling 失败，回退到结构化响应
  console.log('Function Calling失败，回退到结构化响应');
  const fallbackSchema: Record<string, JsonSchemaField> = {};
  const schemaProps = parametersSchema.properties as Record<string, unknown>;
  const schemaRequired = parametersSchema.required as string[] | undefined;

  Object.entries(schemaProps || {}).forEach(([key, value]: [string, unknown]) => {
    const val = value as { type?: string; description?: string };
    fallbackSchema[key] = {
      type: (val.type as JsonSchemaField['type']) || 'string',
      description: (val.description as string) || '',
      required: schemaRequired?.includes(key) || false,
    };
  });

  return await callAiWithStructuredResponse<T>(prompt, fallbackSchema);
}
