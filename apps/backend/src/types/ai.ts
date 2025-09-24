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
  /**
   * 是否开启思维链(当开启后 GLM-4.5 为模型自动判断是否思考，GLM-4.5V 为强制思考), 默认: enabled.
   * https://docs.bigmodel.cn/api-reference/%E6%A8%A1%E5%9E%8B-api/%E5%AF%B9%E8%AF%9D%E8%A1%A5%E5%85%A8#body-thinking
   * Available options: enabled, disabled
   */
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