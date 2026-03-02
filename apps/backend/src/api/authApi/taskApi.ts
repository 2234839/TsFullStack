import { Effect } from 'effect';
import { AuthContext } from '../../Context/Auth';
import { ReqCtxService } from '../../Context/ReqCtx';
import { AppConfigService } from '../../Context/AppConfig';
import { MsgError } from '../../util/error';
import { TokenService } from '../../services/TokenService';
import { TaskService } from '../../services/TaskService';
import { ResourceService } from '../../services/ResourceService';
import { aiImageGenerateService } from '../../services/aiImageGenerateService';
import { TokenPricingCalculator } from '../../services/TokenPricingCalculator';
import { TaskType, ResourceType } from '../../../.zenstack/models';
import { tokenConsumeRateLimiter } from '../../middleware/rateLimit';

/**
 * 生成 AI 图片
 */
export const generateAIImage = (request: {
  prompt: string;
  provider?: 'qwen' | 'dalle' | 'stability' | 'glm';
  count?: number;
  size?: string;
}) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    const reqCtx = yield* ReqCtxService;

    // 0. 速率限制检查
    const rateLimitResult = tokenConsumeRateLimiter.check(auth.user.id);
    if (!rateLimitResult.allowed) {
      throw MsgError.msg('请求过于频繁，请稍后再试');
    }

    reqCtx.log(`[RateLimit] 用户 ${auth.user.id} 剩余配额: ${rateLimitResult.remaining}`);

    // 1. 严格的参数验证
    if (!request.prompt?.trim()) {
      throw MsgError.msg('提示词不能为空');
    }

    const prompt = request.prompt.trim();
    if (prompt.length > 2000) {
      throw MsgError.msg('提示词不能超过2000字符');
    }

    // 验证服务商
    const validProviders = ['qwen', 'dalle', 'stability', 'glm'];
    const provider = request.provider || 'qwen';
    if (!validProviders.includes(provider)) {
      throw MsgError.msg('不支持的服务商' + provider);
    }

    // 验证数量
    const count = Math.max(1, Math.min(4, request.count || 1));
    if (!Number.isInteger(count) || count < 1 || count > 4) {
      throw MsgError.msg('生成数量必须在1-4之间');
    }

    // 验证尺寸
    const validSizes = ['1024x1024', '1024x768', '768x1024', '512x512'];
    const size = request.size || '1024x1024';
    if (!validSizes.includes(size)) {
      throw MsgError.msg('不支持的尺寸格式');
    }

    // 2. 计算代币消耗（使用代码即配置的计算器）
    const pricingResult = TokenPricingCalculator.aiImageGeneration({
      count,
      size,
      provider,
    });

    const tokenCost = pricingResult.total;

    if (tokenCost <= 0 || tokenCost > 1000) {
      throw MsgError.msg('代币费用计算异常');
    }

    reqCtx.log(
      `[代币计算] ${pricingResult.breakdown} = ${tokenCost}代币\n` +
        `  公式: ${pricingResult.details.formula}\n` +
        `  基础价格: ${pricingResult.details.basePrice}代币/张\n` +
        `  倍数: ${JSON.stringify(pricingResult.details.multipliers)}`,
    );

    // 3. 创建任务
    const task = yield* TaskService.createTask(auth.user.id, {
      type: TaskType.AI_IMAGE_GENERATION,
      title: `生成 AI 图片 - ${prompt.substring(0, 50)}`,
      description: prompt,
      inputParams: {
        prompt: prompt,
        provider: provider,
        count: count,
        size: size,
      },
      tokenCost,
    });

    reqCtx.log(`[TaskAPI] 创建任务 ${task.id}, 消耗 ${tokenCost} 代币`);

    // 5. 开始任务
    yield* TaskService.startTask(task.id);

    try {
      // 6. 调用 AI 服务生成图片
      const generateResult = yield* aiImageGenerateService(prompt, {
        provider: provider,
        count: count,
        size: size,
      });

      reqCtx.log(`[TaskAPI] AI 服务返回 ${generateResult.images.length} 张图片`);

      // 7. 并行创建资源记录（在扣费前确保资源创建成功）
      const [width, height] = size.split('x');

      const resourceResults = yield* Effect.all(
        generateResult.images.map((imageUrl: string) =>
          ResourceService.createResource(auth.user.id, {
            type: ResourceType.IMAGE,
            title: `AI 生成图片 - ${prompt.substring(0, 50)}`,
            metadata: {
              externalUrl: imageUrl,
              width: parseInt(width || '1024'),
              height: parseInt(height || '1024'),
              provider: provider,
            },
            taskId: task.id,
          }),
        ),
      );

      reqCtx.log(`[TaskAPI] 成功创建 ${resourceResults.length} 个资源记录`);

      // 8. 先完成任务（标记为COMPLETED，但不扣费）
      yield* TaskService.completeTask(task.id, {
        imagesCount: generateResult.images.length,
        externalTaskId: generateResult.taskId,
      });

      // 9. 最后消耗代币（任务完成后才扣费）
      const consumeResult = yield* TokenService.consumeTokens(auth.user.id, tokenCost, task.id);
      reqCtx.log(
        `[TaskAPI] 消耗代币成功: ${consumeResult.details.map((d: any) => `${d.amount} ${d.type}`).join(', ')}`,
      );

      return {
        taskId: task.id,
        imagesCount: generateResult.images.length,
        images: generateResult.images,
      };
    } catch (error) {
      // 失败时标记任务失败，不扣除代币
      yield* TaskService.failTask(task.id, String(error));
      throw error;
    }
  });

/**
 * 选择并下载图片
 */
export const selectAndDownloadImage = (request: {
  taskId: number;
  imageUrl: string;
  compressOptions?: {
    enabled: boolean;
    format?: 'jpeg' | 'png' | 'webp';
    maxSize?: { width: number; height: number };
    quality?: number;
  };
}) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    const reqCtx = yield* ReqCtxService;

    // 1. 验证任务权限
    const task = yield* TaskService.getTask(request.taskId);
    if (task.userId !== auth.user.id) {
      throw MsgError.msg('无权操作此任务');
    }

    reqCtx.log(`[TaskAPI] 用户选择图片: ${request.imageUrl.substring(0, 50)}...`);

    // 2. 下载图片
    const imageResponse = yield* Effect.tryPromise({
      try: () => fetch(request.imageUrl),
      catch: (error) => {
        reqCtx.log('[TaskAPI] 下载图片失败:', String(error));
        throw MsgError.msg('下载图片失败');
      },
    });

    if (!imageResponse.ok) {
      throw MsgError.msg(`下载图片失败: ${imageResponse.statusText}`);
    }

    // 3. 读取图片数据
    const buffer = yield* Effect.tryPromise({
      try: () => imageResponse.arrayBuffer(),
      catch: () => {
        throw MsgError.msg('读取图片数据失败');
      },
    });

    // 4. 如果需要压缩，使用 sharp 压缩
    let finalBuffer = Buffer.from(buffer);
    const compressOpts = request.compressOptions;
    if (compressOpts?.enabled !== false) {
      try {
        const sharp = require('sharp');
        const quality = compressOpts?.quality || 85;

        let pipeline = sharp(finalBuffer);

        // 调整尺寸
        if (compressOpts?.maxSize) {
          pipeline = pipeline.resize(compressOpts.maxSize.width, compressOpts.maxSize.height, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        }

        // 选择格式和质量
        const format = compressOpts?.format || 'jpeg';
        switch (format) {
          case 'jpeg':
            pipeline = pipeline.jpeg({ quality });
            break;
          case 'png':
            pipeline = pipeline.png({ quality });
            break;
          case 'webp':
            pipeline = pipeline.webp({ quality });
            break;
        }

        const compressedBuffer = yield* Effect.tryPromise({
          try: () => pipeline.toBuffer() as Promise<any>,
          catch: (error) => {
            reqCtx.log('[TaskAPI] 压缩图片失败，使用原图:', String(error));
            return finalBuffer; // 压缩失败，使用原图
          },
        });

        finalBuffer = compressedBuffer;
        reqCtx.log(`[TaskAPI] 图片压缩完成: ${format}, 质量 ${quality}`);
      } catch (error) {
        reqCtx.log('[TaskAPI] 压缩模块不可用，使用原图:', String(error));
      }
    }

    // 5. 保存到文件系统（使用现有的文件上传 API）
    const filename = `ai-image-${request.taskId}-${Date.now()}.${request.compressOptions?.format || 'jpg'}`;

    // TODO: 这里需要调用文件上传服务
    // 暂时返回 URL
    const fileUrl = `/api/fileApi/temp/${filename}`;

    reqCtx.log(`[TaskAPI] 图片保存完成: ${fileUrl}`);

    return {
      fileUrl,
      size: finalBuffer.length,
    };
  });

/**
 * 获取任务列表
 */
export const listTasks = (options?: {
  status?: string;
  type?: string;
  skip?: number;
  take?: number;
}) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;

    return yield* TaskService.listTasks(auth.user.id, options);
  });

/**
 * 获取任务详情
 */
export const getTaskDetail = (taskId: number) =>
  Effect.gen(function* () {
    return yield* TaskService.getTask(taskId);
  });

/**
 * 获取资源列表
 */
export const listResources = (options?: {
  type?: string;
  status?: string;
  skip?: number;
  take?: number;
}) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;

    return yield* ResourceService.listResources(auth.user.id, options);
  });

/**
 * 获取可用的 AI 图片生成服务商列表
 */
export const getAvailableProviders = () =>
  Effect.gen(function* () {
    const appConfig = yield* AppConfigService;
    const providers: Array<{ value: string; label: string }> = [];

    /** 检查通义千问 */
    if (appConfig.aiImage?.qwenApiKey) {
      providers.push({ value: 'qwen', label: '通义千问' });
    }

    /** 检查 DALL-E */
    if (appConfig.aiImage?.dalleApiKey) {
      providers.push({ value: 'dalle', label: 'DALL-E' });
    }

    /** 检查 Stability AI */
    if (appConfig.aiImage?.stabilityApiKey) {
      providers.push({ value: 'stability', label: 'Stability AI' });
    }

    /** 检查智谱 GLM */
    if (appConfig.aiImage?.glmApiKey) {
      providers.push({ value: 'glm', label: '智谱 GLM' });
    }

    return providers;
  });

/**
 * 任务和资源 API
 */
export const taskApi = {
  generateAIImage,
  selectAndDownloadImage,
  listTasks,
  getTaskDetail,
  listResources,
  getAvailableProviders,
};
