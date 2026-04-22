import { Effect } from 'effect';
import { AuthContext } from '../../Context/Auth';
import { ReqCtxService } from '../../Context/ReqCtx';
import { AppConfigService, AppConfig } from '../../Context/AppConfig';
import { MsgError } from '../../util/error';
import { saveFileFromBuffer } from './file';
import { dbTry } from '../../util/dbEffect';
import { TokenService } from '../../services/TokenService';
import { TaskService } from '../../services/TaskService';
import { ResourceService } from '../../services/ResourceService';
import { aiImageGenerateService } from '../../services/aiImageGenerateService';
import { TokenPricingCalculator } from '../../services/TokenPricingCalculator';
import { TaskType, TaskStatus, ResourceType } from '../../../.zenstack/models';
import { tokenConsumeRateLimiter } from '../../middleware/rateLimit';

/** 图片生成参数常量 */
const MAX_PROMPT_LENGTH = 2000;
const MAX_IMAGE_COUNT = 4;
const DEFAULT_IMAGE_SIZE = '1024x1024';
const VALID_IMAGE_SIZES = ['1024x1024', '1024x768', '768x1024', '512x512',
  '1344x768', '768x1344', '864x1152', '1152x864'] as const;
const MAX_TOKEN_COST = 1000;
const PROMPT_TRUNCATE_LENGTH = 50;
const DEFAULT_COMPRESS_QUALITY = 85;

/** sharp 最小类型（可选依赖，不安装时无 @types/sharp） */
interface SharpInstance {
  (input: Buffer | string): SharpPipeline;
}
interface SharpPipeline {
  resize(w: number, h?: number, options?: { fit?: string; withoutEnlargement?: boolean }): SharpPipeline;
  jpeg(options?: { quality?: number }): SharpPipeline;
  png(options?: { quality?: number }): SharpPipeline;
  webp(options?: { quality?: number }): SharpPipeline;
  toBuffer(): Promise<Buffer>;
}

/** AI 图片生成支持的服务商列表 */
const AI_IMAGE_PROVIDERS = ['qwen', 'dalle', 'stability', 'glm'] as const;
export type AiImageProvider = (typeof AI_IMAGE_PROVIDERS)[number];

/** Provider 显示名称映射 */
const PROVIDER_LABELS: Record<AiImageProvider, string> = {
  qwen: '通义千问',
  dalle: 'DALL-E',
  stability: 'Stability AI',
  glm: '智谱 GLM',
};

/** Provider → API Key 配置字段名映射 */
const PROVIDER_KEY_MAP: { readonly [K in AiImageProvider]: keyof NonNullable<AppConfig['aiImage']> } = {
  qwen: 'qwenApiKey',
  dalle: 'dalleApiKey',
  stability: 'stabilityApiKey',
  glm: 'glmApiKey',
};

/** 图片生成请求参数（已验证） */
interface ValidatedImageParams {
  prompt: string;
  provider: AiImageProvider;
  count: number;
  size: string;
}

/** 验证并规范化图片生成参数 */
function validateImageParams(request: {
  prompt?: string;
  provider?: string;
  count?: number;
  size?: string;
}): ValidatedImageParams {
  if (!request.prompt?.trim()) {
    throw MsgError.msg('提示词不能为空');
  }
  const prompt = request.prompt.trim();
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw MsgError.msg(`提示词不能超过${MAX_PROMPT_LENGTH}字符`);
  }

  const rawProvider = request.provider || 'qwen';
  if (!AI_IMAGE_PROVIDERS.includes(rawProvider as AiImageProvider)) {
    throw MsgError.msg('不支持的服务商' + rawProvider);
  }
  const provider = rawProvider as AiImageProvider;

  const count = Math.floor(Math.max(1, Math.min(MAX_IMAGE_COUNT, request.count || 1)));

  const validSizes: string[] = [...VALID_IMAGE_SIZES];
  const size = request.size || DEFAULT_IMAGE_SIZE;
  if (!validSizes.includes(size)) {
    throw MsgError.msg('不支持的尺寸格式');
  }

  return { prompt, provider, count, size };
}

/**
 * 生成 AI 图片
 */
export const generateAIImage = (request: {
  prompt: string;
  provider?: AiImageProvider;
  count?: number;
  size?: string;
}) =>
  Effect.gen(function* () {
    const auth = yield* AuthContext;
    const ctx = yield* ReqCtxService;

    // 1. 速率限制检查
    const rateLimitResult = tokenConsumeRateLimiter.check(auth.user.id);
    if (!rateLimitResult.allowed) {
      throw MsgError.msg('请求过于频繁，请稍后再试');
    }

    // 2. 参数验证
    const { prompt, provider, count, size } = validateImageParams(request);

    // 3. 代币消耗计算
    const pricingResult = TokenPricingCalculator.aiImageGeneration({ count, size, provider });
    const tokenCost = pricingResult.total;

    if (tokenCost <= 0 || tokenCost > MAX_TOKEN_COST) {
      throw MsgError.msg('代币费用计算异常');
    }

    ctx.log(`[TaskAPI] 代币消耗: ${tokenCost}`);

    // 4. 创建任务
    const task = yield* TaskService.createTask(auth.user.id, {
      type: TaskType.AI_IMAGE_GENERATION,
      title: `生成 AI 图片 - ${prompt.substring(0, PROMPT_TRUNCATE_LENGTH)}`,
      description: prompt,
      inputParams: { prompt, provider, count, size },
      tokenCost,
    });

    ctx.log(`[TaskAPI] 创建任务 ${task.id}, 消耗 ${tokenCost} 代币`);

    // 5. 开始任务
    yield* TaskService.startTask(task.id);

    try {
      // 6. 调用 AI 服务生成图片
      const generateResult = yield* aiImageGenerateService(prompt, { provider, count, size });
      ctx.log('[TaskAPI] AI 服务返回 ' + generateResult.images.length + ' 张图片');

      // 7. 批量创建资源记录
      const [width, height] = size.split('x');
      const createManyResult = yield* dbTry('[TaskAPI]', '批量创建资源', () =>
        auth.db.resource.createMany({
          data: generateResult.images.map((imageUrl: string) => ({
            userId: auth.user.id,
            type: ResourceType.IMAGE,
            title: `AI 生成图片 - ${prompt.substring(0, PROMPT_TRUNCATE_LENGTH)}`,
            metadata: {
              externalUrl: imageUrl,
              width: parseInt(width || '1024'),
              height: parseInt(height || '1024'),
              provider,
            },
            taskId: task.id,
            status: 'completed',
          })),
        }),
      );

      ctx.log('[TaskAPI] 批量创建 ' + createManyResult.count + ' 个资源记录');

      // 8. 完成任务
      yield* TaskService.completeTask(task.id, {
        imagesCount: generateResult.images.length,
        externalTaskId: generateResult.taskId,
      });

      // 9. 消耗代币
      const consumeResult = yield* TokenService.consumeTokens(auth.user.id, tokenCost, task.id);
      ctx.log('[TaskAPI] 消耗代币成功, total=' + tokenCost);

      return { taskId: task.id, imagesCount: generateResult.images.length, images: generateResult.images };
    } catch (error: unknown) {
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
    const ctx = yield* ReqCtxService;

    // 1. 验证任务权限
    const task = yield* TaskService.getTask(request.taskId);
    if (task.userId !== auth.user.id) {
      throw MsgError.msg('无权操作此任务');
    }

    ctx.log('[TaskAPI] 用户选择图片, taskId=' + request.taskId);

    // 2. 下载图片
    const imageResponse = yield* Effect.tryPromise({
      try: () => fetch(request.imageUrl),
      catch: (error) => {
        ctx.log('[TaskAPI] 下载图片失败:', String(error));
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
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sharp = require('sharp') as SharpInstance;
        const quality = compressOpts?.quality || DEFAULT_COMPRESS_QUALITY;

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
          try: () => pipeline.toBuffer() as Promise<typeof finalBuffer>,
          catch: (error) => {
            ctx.log('[TaskAPI] 压缩图片失败，使用原图:', String(error));
            return finalBuffer; // 压缩失败，使用原图
          },
        });

        finalBuffer = compressedBuffer;
        ctx.log('[TaskAPI] 图片压缩完成: ' + format + ', 质量 ' + quality);
      } catch (error: unknown) {
        ctx.log('[TaskAPI] 压缩模块不可用，使用原图:', String(error));
      }
    }

    // 5. 复用文件上传系统的 saveFileFromBuffer（统一路径生成、目录创建、DB 记录）
    const ext = (request.compressOptions?.format || 'jpg').replace('jpeg', 'jpg');
    const filename = `ai-image-${request.taskId}-${Date.now()}.${ext}`;

    const fileRecord = yield* saveFileFromBuffer({
      filename,
      mimetype: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      buffer: finalBuffer,
    });

    ctx.log('[TaskAPI] 图片保存完成, size=' + finalBuffer.length + ', fileId=' + fileRecord.id);

    return {
      fileId: fileRecord.id,
      filename: fileRecord.filename,
      size: finalBuffer.length,
    };
  });

/**
 * 获取任务列表
 */
export const listTasks = (options?: {
  status?: TaskStatus;
  type?: TaskType;
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
    const auth = yield* AuthContext;
    const task = yield* TaskService.getTask(taskId);

    if (task.userId !== auth.user.id) {
      throw MsgError.msg('无权查看此任务');
    }

    return task;
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
    const providers: Array<{ value: AiImageProvider; label: string }> = [];

    for (const provider of AI_IMAGE_PROVIDERS) {
      const apiKey = appConfig.aiImage?.[PROVIDER_KEY_MAP[provider]];
      if (apiKey) {
        providers.push({ value: provider, label: PROVIDER_LABELS[provider] });
      }
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
