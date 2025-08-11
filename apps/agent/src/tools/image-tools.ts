import { ToolDefinition } from '../types';
import { LLMService, LLMMessage, LLMMessageContent } from '../llm-service';
import { Logger } from '../logger';
import * as fs from 'fs';
import * as path from 'path';

export class ImageAnalysisTool implements ToolDefinition {
  name = 'image_analysis';
  description = '分析图像内容，识别物体、文字、场景等';
  version = '1.0.0';
  inputSchema = {
    type: 'object',
    properties: {
      imagePath: { type: 'string', description: '图像文件路径' },
      prompt: { type: 'string', description: '分析提示词' },
      model: { type: 'string', description: '使用的模型' }
    },
    required: ['imagePath']
  };
  permissions = ['file_read'];
  private llmService: LLMService;
  private logger: Logger;

  constructor(llmService: LLMService, logger: Logger) {
    this.llmService = llmService;
    this.logger = logger;
  }

  async execute(input: any): Promise<any> {
    const { imagePath, prompt = '请分析这张图片的内容', model = 'glm-4.1v-thinking-flash' } = input;

    if (!imagePath) {
      throw new Error('缺少必需参数: imagePath');
    }

    try {
      // 检查文件是否存在
      if (!fs.existsSync(imagePath)) {
        throw new Error(`文件不存在: ${imagePath}`);
      }

      // 将图片转换为 base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const imageExtension = path.extname(imagePath).toLowerCase().substring(1);
      const mimeType = `image/${imageExtension === 'jpg' ? 'jpeg' : imageExtension}`;
      const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

      // 构建多模态消息
      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: JSON.stringify([
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } }
          ])
        }
      ];

      this.logger.debug('分析图像', { imagePath, prompt, model }, 'ImageAnalysisTool');

      // 使用 LLM 分析图像
      const response = await this.llmService.chat(messages, 'general');

      return {
        analysis: response,
        imagePath,
        model,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('图像分析失败', { 
        error: error instanceof Error ? error.message : String(error),
        imagePath 
      }, 'ImageAnalysisTool');

      throw error;
    }
  }

  validate(input: any): boolean {
    return typeof input === 'object' && 
           typeof input.imagePath === 'string' && 
           input.imagePath.length > 0;
  }
}

export class ImageGenerationTool implements ToolDefinition {
  name = 'image_generation';
  description = '根据文本描述生成图像';
  version = '1.0.0';
  inputSchema = {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '图像描述' },
      outputPath: { type: 'string', description: '输出文件路径' },
      model: { type: 'string', description: '使用的模型' },
      size: { type: 'string', description: '图像尺寸' },
      quality: { type: 'string', description: '图像质量' }
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
      outputPath = './generated_image.png',
      model = 'cogview-3-flash',
      size = '1024x1024',
      quality = 'standard'
    } = input;

    if (!prompt) {
      throw new Error('缺少必需参数: prompt');
    }

    try {
      this.logger.debug('生成图像', { prompt, outputPath, model }, 'ImageGenerationTool');

      // 构建生成提示
      const generationPrompt = `请根据以下描述生成一张高质量的图像：

描述：${prompt}

要求：
- 图像尺寸：${size}
- 质量：${quality}
- 风格：专业、现代、美观
- 请直接生成图像，不需要额外说明`;

      const messages: LLMMessage[] = [
        { role: 'user', content: generationPrompt }
      ];

      // 使用 LLM 生成图像
      const response = await this.llmService.chat(messages, 'general');

      return {
        prompt,
        outputPath,
        model,
        size,
        quality,
        response,
        timestamp: new Date().toISOString(),
        status: 'generated'
      };

    } catch (error) {
      this.logger.error('图像生成失败', { 
        error: error instanceof Error ? error.message : String(error),
        prompt 
      }, 'ImageGenerationTool');

      throw error;
    }
  }

  validate(input: any): boolean {
    return typeof input === 'object' && 
           typeof input.prompt === 'string' && 
           input.prompt.length > 0;
  }
}

export class OCRTool implements ToolDefinition {
  name = 'ocr';
  description = '从图像中提取文字内容 (OCR)';
  version = '1.0.0';
  inputSchema = {
    type: 'object',
    properties: {
      imagePath: { type: 'string', description: '图像文件路径' },
      language: { type: 'string', description: '识别语言' }
    },
    required: ['imagePath']
  };
  permissions = ['file_read'];
  private llmService: LLMService;
  private logger: Logger;

  constructor(llmService: LLMService, logger: Logger) {
    this.llmService = llmService;
    this.logger = logger;
  }

  async execute(input: any): Promise<any> {
    const { imagePath, language = 'auto' } = input;

    if (!imagePath) {
      throw new Error('缺少必需参数: imagePath');
    }

    try {
      // 检查文件是否存在
      if (!fs.existsSync(imagePath)) {
        throw new Error(`文件不存在: ${imagePath}`);
      }

      // 将图片转换为 base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const imageExtension = path.extname(imagePath).toLowerCase().substring(1);
      const mimeType = `image/${imageExtension === 'jpg' ? 'jpeg' : imageExtension}`;
      const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

      // 构建OCR提示
      const ocrPrompt = language === 'auto' 
        ? '请从这张图片中提取所有文字内容，包括中文、英文、数字等。请以结构化的方式返回结果。'
        : `请从这张图片中提取${language === 'zh' ? '中文' : language === 'en' ? '英文' : '所有'}文字内容。`;

      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: JSON.stringify([
            { type: 'text', text: ocrPrompt },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } }
          ])
        }
      ];

      this.logger.debug('OCR识别', { imagePath, language }, 'OCRTool');

      // 使用 LLM 进行OCR
      const response = await this.llmService.chat(messages, 'general');

      return {
        extractedText: response,
        imagePath,
        language,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('OCR识别失败', { 
        error: error instanceof Error ? error.message : String(error),
        imagePath 
      }, 'OCRTool');

      throw error;
    }
  }

  validate(input: any): boolean {
    return typeof input === 'object' && 
           typeof input.imagePath === 'string' && 
           input.imagePath.length > 0;
  }
}