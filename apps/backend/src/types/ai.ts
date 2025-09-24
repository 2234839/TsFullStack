/** ABOUTME: AI 相关的共享类型定义文件 */

/** OpenAI API 请求接口 */
export interface OpenAIRequest {
  model?: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  thinking?: {
    type: 'disabled' | 'auto' | 'interleaved';
  };
}

/** OpenAI API 响应接口 */
export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** AI 模型配置类型 */
export interface AIModel {
  id: number;
  name: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  maxTokens: number;
  temperature: number;
  enabled: boolean;
  weight: number;
  rpmLimit: number;
  rphLimit: number;
  rpdLimit: number;
  description?: string;
}