import { AgentConfig } from './types';
import { Logger } from './logger';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface LLMMessageContent {
  type: 'text' | 'image_url' | 'video_url';
  text?: string;
  image_url?: { url: string; detail?: 'auto' | 'low' | 'high' };
  video_url?: { url: string };
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | LLMMessageContent[];
}

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  // 多模态模型支持
  supportsImages?: boolean;
  supportsVideo?: boolean;
  // 模型类型
  modelType?: 'text' | 'vision' | 'video' | 'thinking';
}

export interface LLMTaskType {
  planning: string;        // Model for task planning
  execution: string;       // Model for tool execution decisions
  validation: string;      // Model for result validation
  repair: string;          // Model for error repair
  general: string;         // Default model
}

export class LLMService {
  private configs: Map<string, LLMConfig> = new Map();
  private taskModels: LLMTaskType;
  private logger: Logger;
  private defaultConfig: LLMConfig;

  constructor(taskModels: LLMTaskType, logger: Logger) {
    this.taskModels = taskModels;
    this.logger = logger;
    
    // Default configuration
    this.defaultConfig = {
      apiKey: '',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      model: 'glm-4-flash',
      maxTokens: 4000,
      temperature: 0.7,
      timeout: 30000
    };
  }

  async initialize(): Promise<void> {
    // Load configurations from environment
    await this.loadConfigurations();
    
    this.logger.info('LLM Service initialized', { 
      models: Array.from(this.configs.keys()),
      taskModels: this.taskModels 
    }, 'LLMService');
  }

  async chat(messages: LLMMessage[], taskType: keyof LLMTaskType = 'general'): Promise<string> {
    const modelName = this.taskModels[taskType];
    const config = this.configs.get(modelName) || this.defaultConfig;
    
    if (!config.apiKey) {
      throw new Error(`API key not configured for model: ${modelName}`);
    }

    this.logger.debug('LLM chat request', { 
      model: modelName, 
      messagesCount: messages.length,
      taskType 
    }, 'LLMService');

    try {
      const response = await this.makeAPIRequest(messages, config);
      this.logger.debug('LLM chat response', { 
        model: modelName,
        responseLength: response.length 
      }, 'LLMService');
      
      return response;
    } catch (error) {
      this.logger.error('LLM chat failed', { 
        error: error instanceof Error ? error.message : String(error),
        model: modelName,
        taskType 
      }, 'LLMService');
      throw error;
    }
  }

  async planTask(description: string): Promise<string> {
    const systemPrompt = `你是一个任务规划助手。根据用户描述的任务，制定详细的执行步骤。

请按照以下格式返回：
1. 分析任务需求
2. 确定需要的工具
3. 制定执行步骤
4. 预期结果

任务描述：${description}`;

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: description }
    ];

    return await this.chat(messages, 'planning');
  }

  async selectTool(description: string, availableTools: string[]): Promise<string> {
    const toolsList = availableTools.join(', ');
    const systemPrompt = `你是一个工具选择助手。根据任务描述和可用工具，选择最合适的工具。

可用工具：${toolsList}

请只返回工具名称，不要解释。如果不需要工具，返回"none"。

任务描述：${description}`;

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: description }
    ];

    return await this.chat(messages, 'execution');
  }

  async validateResult(taskDescription: string, result: any): Promise<boolean> {
    const systemPrompt = `你是一个结果验证助手。根据原始任务描述和执行结果，验证任务是否成功完成。

请只返回"true"或"false"。

任务描述：${taskDescription}
执行结果：${JSON.stringify(result)}`;

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请验证这个结果是否满足任务要求' }
    ];

    const response = await this.chat(messages, 'validation');
    return response.toLowerCase().includes('true');
  }

  async repairError(taskDescription: string, error: string, failedSteps: any[]): Promise<string> {
    const systemPrompt = `你是一个错误修复助手。根据任务描述、错误信息和失败步骤，提供修复建议。

任务描述：${taskDescription}
错误信息：${error}
失败步骤：${JSON.stringify(failedSteps, null, 2)}

请提供修复策略和替代方案。`;

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请分析错误并提供修复建议' }
    ];

    return await this.chat(messages, 'repair');
  }

  private async makeAPIRequest(messages: LLMMessage[], config: LLMConfig): Promise<string> {
    const payload = {
      model: config.model,
      messages: messages,
      max_tokens: config.maxTokens || 4000,
      temperature: config.temperature || 0.7,
      stream: false
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeout || 30000);

    try {
      const response = await fetch(config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  private async loadConfigurations(): Promise<void> {
    // Load from environment variables
    const envModels = process.env.LLM_MODELS ? JSON.parse(process.env.LLM_MODELS) : {};
    
    // Default models configuration with new Flash models
    const defaultModels: LLMTaskType = {
      planning: process.env.LLM_MODEL_PLANNING || 'glm-4.5-flash',
      execution: process.env.LLM_MODEL_EXECUTION || 'glm-4.5-flash',
      validation: process.env.LLM_MODEL_VALIDATION || 'glm-4.5-air',
      repair: process.env.LLM_MODEL_REPAIR || 'glm-4.5-air',
      general: process.env.LLM_MODEL_GENERAL || 'glm-4.5-flash'
    };

    this.taskModels = defaultModels;

    // Configure each model with type detection
    for (const [taskType, modelName] of Object.entries(defaultModels)) {
      const config: LLMConfig = {
        apiKey: process.env[`LLM_API_KEY_${modelName.toUpperCase()}`] || process.env.LLM_API_KEY || '',
        baseUrl: process.env[`LLM_BASE_URL_${modelName.toUpperCase()}`] || process.env.LLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        model: modelName,
        maxTokens: parseInt(process.env[`LLM_MAX_TOKENS_${modelName.toUpperCase()}`] || process.env.LLM_MAX_TOKENS || '4000'),
        temperature: parseFloat(process.env[`LLM_TEMPERATURE_${modelName.toUpperCase()}`] || process.env.LLM_TEMPERATURE || '0.7'),
        timeout: parseInt(process.env[`LLM_TIMEOUT_${modelName.toUpperCase()}`] || process.env.LLM_TIMEOUT || '30000'),
        // Set model capabilities based on model name
        ...this.getModelCapabilities(modelName)
      };

      this.configs.set(modelName, config);
    }

    // Add the provided API key as default
    if (process.env.LLM_API_KEY) {
      this.defaultConfig.apiKey = process.env.LLM_API_KEY;
    }
  }

  private getModelCapabilities(modelName: string): Partial<LLMConfig> {
    // Model capabilities configuration
    const modelCapabilities: Record<string, Partial<LLMConfig>> = {
      // Text models
      'glm-4.5-flash': { modelType: 'text' },
      'glm-4-flash': { modelType: 'text' },
      'glm-z1-flash': { modelType: 'text' },
      'glm-4.5-air': { modelType: 'text' },
      
      // Vision models
      'glm-4.1v-thinking-flash': { 
        modelType: 'vision', 
        supportsImages: true 
      },
      'cogview-3-flash': { 
        modelType: 'vision', 
        supportsImages: true 
      },
      
      // Video models
      'cogvideox-flash': { 
        modelType: 'video', 
        supportsVideo: true 
      }
    };

    return modelCapabilities[modelName] || { modelType: 'text' };
  }

  // Get available models
  getAvailableModels(): string[] {
    return Array.from(this.configs.keys());
  }

  // Get model configuration
  getModelConfig(modelName: string): LLMConfig | null {
    return this.configs.get(modelName) || null;
  }

  // Update task model assignment
  updateTaskModel(taskType: keyof LLMTaskType, modelName: string): void {
    if (this.configs.has(modelName)) {
      this.taskModels[taskType] = modelName;
      this.logger.info('Task model updated', { taskType, modelName }, 'LLMService');
    } else {
      throw new Error(`Model ${modelName} not found`);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const testMessage: LLMMessage[] = [
        { role: 'user', content: 'Hello, this is a health check.' }
      ];
      await this.chat(testMessage, 'general');
      return true;
    } catch (error) {
      this.logger.error('LLM health check failed', { 
        error: error instanceof Error ? error.message : String(error) 
      }, 'LLMService');
      return false;
    }
  }
}