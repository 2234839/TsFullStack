import { Effect } from 'effect';
import { AuthContext } from '../../Context/Auth';
import { ReqCtxService } from '../../Context/ReqCtx';
import { AppConfigService, AppConfig } from '../../Context/AppConfig';
import { MsgError, fail, neverReturn } from '../../util/error';
import { saveFileFromBuffer } from './file';
import { dbTry } from '../../util/dbEffect';
import { TokenService } from '../../services/TokenService';
import { TaskService } from '../../services/TaskService';
import { ResourceService } from '../../services/ResourceService';
import { aiImageGenerateService } from '../../services/aiImageGenerateService';
import { TokenPricingCalculator } from '../../services/TokenPricingCalculator';
import { withFetchTimeout, FETCH_TIMEOUTS } from '../../util/http';
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

/** 允许的图片 URL 协议 */
const ALLOWED_URL_PROTOCOLS = ['https:', 'http:'];

/** 私有 IP 地址段正则（防止 SSRF 攻击） */
const PRIVATE_IP_PATTERNS = [
  /^127\./, // loopback
  /^10\./, // RFC1918 Class A
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC1918 Class B
  /^192\.168\./, // RFC1918 Class C
  /^169\.254\./, // link-local
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 unique local
  /^fe80:/i, // IPv6 link-local
];

/** 校验图片 URL 是否安全（防止 SSRF） */
function validateImageUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw MsgError.msg('无效的图片URL格式');
  }

  if (!ALLOWED_URL_PROTOCOLS.includes(parsed.protocol)) {
    throw MsgError.msg('图片URL协议不允许: ' + parsed.protocol);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '[::1]') {
    throw MsgError.msg('禁止访问本地地址');
  }
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      throw MsgError.msg('禁止访问私有IP地址');
    }
  }
}

/** sharp 最小类型（可选依赖，不安装时无 @types/sharp） */
interface SharpInstance {
  (input: Buffer | string): SharpPipeline;
}

/** sharp 模块缓存（避免每次调用重复 require） */
let cachedSharp: SharpInstance | null = null;
let sharpLoadAttempted = false;

function getSharp(): SharpInstance | null {
  if (!sharpLoadAttempted) {
    sharpLoadAttempted = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cachedSharp = require('sharp') as SharpInstance;
    } catch {
      cachedSharp = null;
    }
  }
  return cachedSharp;
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
const validateImageParams = (request: {
  prompt?: string;
  provider?: string;
  count?: number;
  size?: string;
}): Effect.Effect<ValidatedImageParams, MsgError> =>
  Effect.gen(function* () {
    if (!request.prompt?.trim()) {
      yield* Effect.fail(MsgError.msg('提示词不能为空'));
      return neverReturn();
    }
    const prompt = request.prompt.trim()!;
    if (prompt.length > MAX_PROMPT_LENGTH) {
      yield* Effect.fail(MsgError.msg(`提示词不能超过${MAX_PROMPT_LENGTH}字符`));
      return neverReturn();
    }

    const rawProvider = request.provider || 'qwen';
    if (!AI_IMAGE_PROVIDERS.includes(rawProvider as AiImageProvider)) {
      yield* Effect.fail(MsgError.msg('不支持的服务商' + rawProvider));
      return neverReturn();
    }
    const provider = rawProvider as AiImageProvider;

    const count = Math.floor(Math.max(1, Math.min(MAX_IMAGE_COUNT, request.count || 1)));

    const validSizes: string[] = [...VALID_IMAGE_SIZES];
    const size = request.size || DEFAULT_IMAGE_SIZE;
    if (!validSizes.includes(size)) {
      yield* Effect.fail(MsgError.msg('不支持的尺寸格式'));
      return neverReturn();
    }

    return { prompt, provider, count, size };
  });

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
      yield* fail('请求过于频繁，请稍后再试');
      return neverReturn();
    }

    // 2. 参数验证
    const { prompt, provider, count, size } = yield* validateImageParams(request);

    // 3. 代币消耗计算
    const pricingResult = TokenPricingCalculator.aiImageGeneration({ count, size, provider });
    const tokenCost = pricingResult.total;

    if (tokenCost <= 0 || tokenCost > MAX_TOKEN_COST) {
      yield* fail('代币费用计算异常');
      return neverReturn();
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

    /** 图片生成 → 创建资源 → 完成任务 → 消耗代币 的完整管道，失败时标记任务为 failed */
    const result = yield* aiImageGenerateService(prompt, { provider, count, size }).pipe(
      Effect.tap((generateResult) => {
        ctx.log('[TaskAPI] AI 服务返回 ' + generateResult.images.length + ' 张图片');
      }),
      Effect.andThen((generateResult) =>
        Effect.gen(function* () {
          // 7. 批量创建资源记录
          const [rawWidth, rawHeight] = size.split('x');
          /** parseInt 防御：非法格式回退到默认值 */
          const width = Math.max(1, parseInt(rawWidth || '1024') || 1024);
          const height = Math.max(1, parseInt(rawHeight || '1024') || 1024);
          const createManyResult = yield* dbTry('[TaskAPI]', '批量创建资源', () =>
            auth.db.resource.createMany({
              data: generateResult.images.map((imageUrl: string) => ({
                userId: auth.user.id,
                type: ResourceType.IMAGE,
                title: `AI 生成图片 - ${prompt.substring(0, PROMPT_TRUNCATE_LENGTH)}`,
                metadata: {
                  externalUrl: imageUrl,
                  width,
                  height,
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
          yield* TokenService.consumeTokens(auth.user.id, tokenCost, task.id);
          ctx.log('[TaskAPI] 消耗代币成功, total=' + tokenCost);

          return { taskId: task.id, imagesCount: generateResult.images.length, images: generateResult.images };
        }),
      ),
      /** 失败时标记任务为 FAILED 并传播原始错误（yield* 确保 Effect 在正确上下文中执行） */
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* TaskService.failTask(task.id, String(error));
          return yield* Effect.fail(error);
        }),
      ),
    );

    return result;
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
    const ctx = yield* ReqCtxService;

    /** taskId 必须为正整数 */
    if (!request.taskId || typeof request.taskId !== 'number' || request.taskId <= 0 || !Number.isFinite(request.taskId)) {
      yield* fail('taskId 无效');
      return neverReturn();
    }

    // 1. 验证任务权限（Service 层已校验 userId）
    const task = yield* TaskService.getTask(request.taskId);

    ctx.log('[TaskAPI] 用户选择图片, taskId=' + request.taskId);

    // 2. 校验 imageUrl 安全性（SSRF 防护）
    yield* Effect.sync(() => validateImageUrl(request.imageUrl));

    // 3. 下载图片
    const imageResponse = yield* Effect.tryPromise({
      try: () => fetch(request.imageUrl, withFetchTimeout({}, FETCH_TIMEOUTS.imageDownload)),
      catch: (error) => {
        ctx.log('[TaskAPI] 下载图片失败:', String(error));
        return MsgError.msg('下载图片失败');
      },
    });

    if (!imageResponse.ok) {
      yield* fail(`下载图片失败: ${imageResponse.statusText}`);
      return neverReturn();
    }

    // 3. 读取图片数据
    const buffer = yield* Effect.tryPromise({
      try: () => imageResponse.arrayBuffer(),
      catch: () => {
        return MsgError.msg('读取图片数据失败');
      },
    });

    // 4. 如果需要压缩，使用 sharp 压缩
    let finalBuffer: Buffer = Buffer.from(buffer);
    const compressOpts = request.compressOptions;
    if (compressOpts?.enabled !== false) {
      /** sharp 压缩管道：模块不存在或压缩失败时降级为原图 */
      const compressionResult: Buffer = yield* Effect.tryPromise({
        try: async (): Promise<Buffer> => {
          const sharp = getSharp();
          if (!sharp) throw MsgError.msg('sharp 模块未安装');
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

          return pipeline.toBuffer() as Promise<Buffer>;
        },
        catch: (error) => {
          ctx.log('[TaskAPI] 压缩图片失败，使用原图:', String(error));
          return finalBuffer;
        },
      });

      finalBuffer = compressionResult;
      ctx.log('[TaskAPI] 图片压缩完成: ' + (compressOpts?.format || 'jpeg') + ', 质量 ' + (compressOpts?.quality || DEFAULT_COMPRESS_QUALITY));
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
    // Service 层 getTask 已校验 userId 权限
    const task = yield* TaskService.getTask(taskId);

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
