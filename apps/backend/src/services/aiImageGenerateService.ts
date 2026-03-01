import { Effect } from 'effect';
import { ReqCtxService } from '../Context/ReqCtx';
import { AppConfigService } from '../Context/AppConfig';
import { MsgError } from '../util/error';

/**
 * AI 图片生成结果
 */
export interface AIImageGenerateResult {
  /** 图片 URL 列表 */
  images: string[];
  /** 任务 ID */
  taskId: string;
}

/**
 * AI 图片生成服务
 */
export const aiImageGenerateService = (
  prompt: string,
  options: {
    provider: 'qwen' | 'dalle' | 'stability' | 'glm';
    count?: number;
    size?: string;
    quality?: string;
  }
): Effect.Effect<
  AIImageGenerateResult,
  Error | string,
  ReqCtxService | AppConfigService
> =>
  Effect.gen(function* () {
    const reqCtx = yield* ReqCtxService;
    reqCtx.log(`[AIImage] 生成图片 - Provider: ${options.provider}, Prompt: ${prompt.substring(0, 50)}...`);

    switch (options.provider) {
      case 'qwen':
        return yield* generateWithQwen(prompt, options);
      case 'dalle':
        return yield* generateWithDalle(prompt, options);
      case 'stability':
        return yield* generateWithStability(prompt, options);
      case 'glm':
        return yield* generateWithGlm(prompt, options);
      default:
        throw MsgError.msg('不支持的 AI 服务提供商');
    }
  });

/**
 * 通义千问图片生成
 */
function generateWithQwen(
  prompt: string,
  options: {
    provider: string;
    count?: number;
    size?: string;
    quality?: string;
  }
): Effect.Effect<
  AIImageGenerateResult,
  Error | string,
  ReqCtxService | AppConfigService
> {
  return Effect.gen(function* () {
    const reqCtx = yield* ReqCtxService;
    const appConfig = yield* AppConfigService;

    const apiKey = appConfig.aiImage?.qwenApiKey;
    if (!apiKey) {
      throw MsgError.msg('通义千问 API Key 未配置');
    }

    const response = yield* Effect.tryPromise({
      try: () =>
        fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'wanx-v1',
            input: {
              prompt: prompt,
            },
            parameters: {
              size: options.size || '1024*1024',
              n: options.count || 1,
            },
          }),
        }),
      catch: (error) => {
        reqCtx.log('[AIImage] 调用通义千问 API 失败:', String(error));
        throw MsgError.msg('调用 AI 服务失败');
      },
    });

    if (!response.ok) {
      throw MsgError.msg(`AI 服务返回错误: ${response.statusText}`);
    }

    const result = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () => {
        throw MsgError.msg('解析 AI 响应失败');
      },
    });

    if (result.code !== 'Success') {
      throw MsgError.msg(`AI 生成失败: ${result.message}`);
    }

    const images: string[] = result.output?.results?.map((r: { url: string }) => r.url) || [];

    return {
      images,
      taskId: result.request_id,
    };
  });
}

/**
 * DALL-E 图片生成
 */
function generateWithDalle(
  prompt: string,
  options: {
    provider: string;
    count?: number;
    size?: string;
    quality?: string;
  }
): Effect.Effect<
  AIImageGenerateResult,
  Error | string,
  ReqCtxService | AppConfigService
> {
  return Effect.gen(function* () {
    const reqCtx = yield* ReqCtxService;
    const appConfig = yield* AppConfigService;

    const apiKey = appConfig.aiImage?.dalleApiKey;
    if (!apiKey) {
      throw MsgError.msg('DALL-E API Key 未配置');
    }

    // DALL-E 只支持单张生成
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: prompt,
            n: 1,
            size: options.size || '1024x1024',
          }),
        }),
      catch: (error) => {
        reqCtx.log('[AIImage] 调用 DALL-E API 失败:', String(error));
        throw MsgError.msg('调用 AI 服务失败');
      },
    });

    if (!response.ok) {
      throw MsgError.msg(`AI 服务返回错误: ${response.statusText}`);
    }

    const result = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () => {
        throw MsgError.msg('解析 AI 响应失败');
      },
    });

    const images: string[] = result.data?.map((item: { url: string }) => item.url) || [];

    return {
      images,
      taskId: result.created,
    };
  });
}

/**
 * Stability AI 图片生成
 */
function generateWithStability(
  prompt: string,
  options: {
    provider: string;
    count?: number;
    size?: string;
    quality?: string;
  }
): Effect.Effect<
  AIImageGenerateResult,
  Error | string,
  ReqCtxService | AppConfigService
> {
  return Effect.gen(function* () {
    const reqCtx = yield* ReqCtxService;
    const appConfig = yield* AppConfigService;

    const apiKey = appConfig.aiImage?.stabilityApiKey;
    if (!apiKey) {
      throw MsgError.msg('Stability AI API Key 未配置');
    }

    // 解析尺寸
    const [width, height] = (options.size || '1024x1024').split('x').map(Number);

    const response = yield* Effect.tryPromise({
      try: () =>
        fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            text_prompts: [
              {
                text: prompt,
              },
            ],
            cfg_scale: 7,
            height: height || 1024,
            width: width || 1024,
            steps: 30,
            samples: options.count || 1,
          }),
        }),
      catch: (error) => {
        reqCtx.log('[AIImage] 调用 Stability API 失败:', String(error));
        throw MsgError.msg('调用 AI 服务失败');
      },
    });

    if (!response.ok) {
      throw MsgError.msg(`AI 服务返回错误: ${response.statusText}`);
    }

    const result = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () => {
        throw MsgError.msg('解析 AI 响应失败');
      },
    });

    const images: string[] = result.artifacts?.map((item: { base64: string }) => `data:image/png;base64,${item.base64}`) || [];

    return {
      images,
      taskId: result.request_id,
    };
  });
}

/**
 * 智谱 GLM 图片生成 (CogView)
 */
function generateWithGlm(
  prompt: string,
  options: {
    provider: string;
    count?: number;
    size?: string;
    quality?: string;
  }
): Effect.Effect<
  AIImageGenerateResult,
  Error | string,
  ReqCtxService | AppConfigService
> {
  return Effect.gen(function* () {
    const reqCtx = yield* ReqCtxService;
    const appConfig = yield* AppConfigService;

    const apiKey = appConfig.aiImage?.glmApiKey;
    if (!apiKey) {
      throw MsgError.msg('智谱 GLM API Key 未配置');
    }

    // 解析尺寸，智谱支持: 1024x1024, 768x1344, 864x1152, 1344x768, 1152x864
    const sizeMap: Record<string, string> = {
      '1024x1024': '1024x1024',
      '768x1344': '768x1344',
      '864x1152': '864x1152',
      '1344x768': '1344x768',
      '1152x864': '1152x864',
    };
    const size = sizeMap[options.size || '1024x1024'] || '1024x1024';

    const response = yield* Effect.tryPromise({
      try: () =>
        fetch('https://open.bigmodel.cn/api/paas/v4/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'cogview-3-plus', // 使用智谱最新的文生图模型
            prompt: prompt,
            size: size,
            n: options.count || 1,
          }),
        }),
      catch: (error) => {
        reqCtx.log('[AIImage] 调用智谱 GLM API 失败:', String(error));
        throw MsgError.msg('调用 AI 服务失败');
      },
    });

    if (!response.ok) {
      const errorText = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: () => 'Unknown error',
      });
      throw MsgError.msg(`AI 服务返回错误: ${response.statusText} - ${errorText}`);
    }

    const result = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () => {
        throw MsgError.msg('解析 AI 响应失败');
      },
    });

    if (result.error) {
      throw MsgError.msg(`智谱 GLM 生成失败: ${result.error.message || result.error}`);
    }

    const images: string[] = result.data?.map((item: { url: string }) => item.url) || [];

    return {
      images,
      taskId: result.id || Date.now().toString(),
    };
  });
}
