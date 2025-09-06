import { Context } from 'effect';

export class AIConfigContext extends Context.Tag('AIConfigService')<
  AIConfigContext,
  AIConfig
>() {}

/** AI服务配置 */
export type AIConfig = {
  /** Ollama服务配置 */
  ollama: {
    /** Ollama API URL */
    url: string;
    /** 默认使用的模型 */
    defaultModel: string;
  };
};

/** 默认AI配置 */
export const DefaultAIConfig: AIConfig = {
  ollama: {
    url: 'http://localhost:11434',
    defaultModel: 'llama3.2',
  },
};