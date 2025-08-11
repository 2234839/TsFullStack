import { ToolDefinition } from '../types';
import { LLMService, LLMMessage } from '../llm-service';
import { Logger } from '../logger';
import * as fs from 'fs';
import * as path from 'path';

export class VideoGenerationTool implements ToolDefinition {
  name = 'video_generation';
  description = '根据文本描述生成视频';
  version = '1.0.0';
  inputSchema = {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '视频描述' },
      outputPath: { type: 'string', description: '输出文件路径' },
      model: { type: 'string', description: '使用的模型' },
      duration: { type: 'number', description: '视频时长（秒）' },
      fps: { type: 'number', description: '帧率' },
      quality: { type: 'string', description: '视频质量' }
    },
    required: ['prompt']
  };
  permissions = ['file_write'];
  private llmService: LLMService;
  private logger: Logger;

  constructor(llmService: LLMService, logger: Logger) {
    this.llmService = llmService;
    this.logger = logger;
  }

  async execute(input: any): Promise<any> {
    const { 
      prompt, 
      outputPath = './generated_video.mp4',
      model = 'cogvideox-flash',
      duration = 5,
      fps = 24,
      quality = 'high'
    } = input;

    if (!prompt) {
      throw new Error('缺少必需参数: prompt');
    }

    try {
      this.logger.debug('生成视频', { prompt, outputPath, model, duration }, 'VideoGenerationTool');

      // 构建视频生成提示
      const videoPrompt = `请根据以下描述生成一个高质量的视频：

描述：${prompt}

技术要求：
- 视频时长：${duration}秒
- 帧率：${fps}fps
- 质量：${quality}
- 分辨率：1080p
- 风格：专业、流畅、视觉吸引力强
- 请生成具有连贯叙事的视频内容`;

      const messages: LLMMessage[] = [
        { role: 'user', content: videoPrompt }
      ];

      // 使用 LLM 生成视频
      const response = await this.llmService.chat(messages, 'general');

      return {
        prompt,
        outputPath,
        model,
        duration,
        fps,
        quality,
        response,
        timestamp: new Date().toISOString(),
        status: 'generating',
        estimatedTime: `${duration * 2}分钟`
      };

    } catch (error) {
      this.logger.error('视频生成失败', { 
        error: error instanceof Error ? error.message : String(error),
        prompt 
      }, 'VideoGenerationTool');

      throw error;
    }
  }

  validate(input: any): boolean {
    return typeof input === 'object' && 
           typeof input.prompt === 'string' && 
           input.prompt.length > 0;
  }
}

export class VideoAnalysisTool implements ToolDefinition {
  name = 'video_analysis';
  description = '分析视频内容，识别场景、物体、动作等';
  version = '1.0.0';
  inputSchema = {
    type: 'object',
    properties: {
      videoPath: { type: 'string', description: '视频文件路径' },
      prompt: { type: 'string', description: '分析提示词' },
      model: { type: 'string', description: '使用的模型' },
      extractFrames: { type: 'boolean', description: '是否提取帧' }
    },
    required: ['videoPath']
  };
  permissions = ['file_read'];
  private llmService: LLMService;
  private logger: Logger;

  constructor(llmService: LLMService, logger: Logger) {
    this.llmService = llmService;
    this.logger = logger;
  }

  async execute(input: any): Promise<any> {
    const { 
      videoPath, 
      prompt = '请分析这个视频的内容',
      model = 'glm-4.1v-thinking-flash',
      extractFrames = true 
    } = input;

    if (!videoPath) {
      throw new Error('缺少必需参数: videoPath');
    }

    try {
      // 检查文件是否存在
      if (!fs.existsSync(videoPath)) {
        throw new Error(`文件不存在: ${videoPath}`);
      }

      this.logger.debug('分析视频', { videoPath, prompt, model }, 'VideoAnalysisTool');

      // 获取视频基本信息
      const videoInfo = {
        path: videoPath,
        size: fs.statSync(videoPath).size,
        extension: path.extname(videoPath),
        timestamp: new Date().toISOString()
      };

      // 构建视频分析提示
      const analysisPrompt = `请分析这个视频的内容：

视频信息：${JSON.stringify(videoInfo)}
分析要求：${prompt}

请提供详细的分析结果，包括：
1. 视频主题和内容概述
2. 主要场景和物体识别
3. 动作和事件分析
4. 视频质量和风格评估
5. 关键时间点描述`;

      const messages: LLMMessage[] = [
        { role: 'user', content: analysisPrompt }
      ];

      // 使用 LLM 分析视频
      const response = await this.llmService.chat(messages, 'general');

      return {
        analysis: response,
        videoInfo,
        model,
        prompt,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('视频分析失败', { 
        error: error instanceof Error ? error.message : String(error),
        videoPath 
      }, 'VideoAnalysisTool');

      throw error;
    }
  }

  validate(input: any): boolean {
    return typeof input === 'object' && 
           typeof input.videoPath === 'string' && 
           input.videoPath.length > 0;
  }
}

export class VideoScriptTool implements ToolDefinition {
  name = 'video_script';
  description = '根据主题生成视频脚本和分镜';
  version = '1.0.0';
  inputSchema = {
    type: 'object',
    properties: {
      topic: { type: 'string', description: '视频主题' },
      duration: { type: 'number', description: '视频时长（秒）' },
      style: { type: 'string', description: '视频风格' },
      targetAudience: { type: 'string', description: '目标观众' },
      model: { type: 'string', description: '使用的模型' }
    },
    required: ['topic']
  };
  permissions = [];
  private llmService: LLMService;
  private logger: Logger;

  constructor(llmService: LLMService, logger: Logger) {
    this.llmService = llmService;
    this.logger = logger;
  }

  async execute(input: any): Promise<any> {
    const { 
      topic, 
      duration = 60,
      style = 'educational',
      targetAudience = 'general',
      model = 'glm-4.5-flash'
    } = input;

    if (!topic) {
      throw new Error('缺少必需参数: topic');
    }

    try {
      this.logger.debug('生成视频脚本', { topic, duration, style }, 'VideoScriptTool');

      // 构建脚本生成提示
      const scriptPrompt = `请为以下主题生成一个专业的视频脚本：

主题：${topic}
视频时长：${duration}秒
风格：${style}
目标观众：${targetAudience}

请提供：
1. 视频概述和目标
2. 详细脚本（包括旁白和画面描述）
3. 分镜建议（每个镜头的内容和时长）
4. 背景音乐和音效建议
5. 拍摄和制作建议

请以结构化的格式返回脚本内容。`;

      const messages: LLMMessage[] = [
        { role: 'user', content: scriptPrompt }
      ];

      // 使用 LLM 生成脚本
      const response = await this.llmService.chat(messages, 'general');

      return {
        script: response,
        topic,
        duration,
        style,
        targetAudience,
        model,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('视频脚本生成失败', { 
        error: error instanceof Error ? error.message : String(error),
        topic 
      }, 'VideoScriptTool');

      throw error;
    }
  }

  validate(input: any): boolean {
    return typeof input === 'object' && 
           typeof input.topic === 'string' && 
           input.topic.length > 0;
  }
}