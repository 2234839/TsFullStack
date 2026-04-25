import { Effect } from 'effect';
import { ReqCtxService } from '../Context/ReqCtx';
import { AppConfigService } from '../Context/AppConfig';
import { MsgError, fail, requireOrFail, tryOrFail, extractErrorMessage } from '../util/error';
import { JSON_CONTENT_HEADERS, DEFAULT_IMAGE_SIZE, type AiImageProvider } from '../util/constants';
import { withFetchTimeout, FETCH_TIMEOUTS } from '../util/http';

const LOG_PREFIX = '[AIImage]';

/**
 * AI 图片生成结果
 */
export interface AIImageGenerateResult {
  /** 图片 URL 列表 */
  images: string[];
  /** 任务 ID */
  taskId: string;
}

/** 图片生成 Provider 配置 */
interface ProviderConfig {
  /** API Key 在配置中的字段名 */
  apiKeyField: 'qwenApiKey' | 'dalleApiKey' | 'stabilityApiKey' | 'glmApiKey';
  /** API Key 未配置时的错误信息 */
  missingKeyMsg: string;
  /** 构建请求参数 */
  buildRequest: (prompt: string, options: { count?: number; size?: string; quality?: string }) => {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  };
  /** 解析响应为图片列表和任务 ID（可能返回 MsgError 表示业务错误） */
  parseResponse: (result: Record<string, unknown>) => { images: string[]; taskId: string } | MsgError;
  /** 可选的错误详情提取（用于非 ok 响应） */
  extractErrorDetail?: (response: Response) => Effect.Effect<string, string>;
}

/**
 * AI 图片生成服务
 */
export const aiImageGenerateService = (
  prompt: string,
  options: {
    provider: AiImageProvider;
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
    reqCtx.log(`${LOG_PREFIX} 生成图片, provider=${options.provider}`);

    const config = yield* requireOrFail(getProviderConfig(options.provider), '不支持的 AI 服务提供商');

    return yield* callImageProvider(prompt, options, config);
  });

/**
 * 通用的图片 Provider 调用逻辑
 */
function callImageProvider(
  prompt: string,
  options: { count?: number; size?: string; quality?: string },
  config: ProviderConfig,
) {
  return Effect.gen(function* () {
    const reqCtx = yield* ReqCtxService;
    const appConfig = yield* AppConfigService;

    const apiKey = yield* requireOrFail(
      appConfig.aiImage?.[config.apiKeyField],
      config.missingKeyMsg,
    );

    const { url, headers, body } = config.buildRequest(prompt, options);

    // 注入 Authorization header
    headers['Authorization'] = `Bearer ${apiKey}`;

    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(url, withFetchTimeout({
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }, FETCH_TIMEOUTS.aiImage)),
      catch: (e) => {
        reqCtx.log(`${LOG_PREFIX} 调用 AI API 失败: ${extractErrorMessage(e)}`);
        if (MsgError.isMsgError(e)) return e;
        return MsgError.msg(`调用 AI 服务失败: ${extractErrorMessage(e)}`);
      },
    });

    if (!response.ok) {
      if (config.extractErrorDetail) {
        const detail = yield* config.extractErrorDetail(response);
        return yield* fail(`AI 服务返回错误: ${response.statusText} - ${detail}`);
      }
      return yield* fail(`AI 服务返回错误: ${response.statusText}`);
    }

    const result = yield* tryOrFail('解析 AI 响应', () => response.json() as Promise<Record<string, unknown>>);

    const parsed = config.parseResponse(result);
    if (MsgError.isMsgError(parsed)) {
      return yield* Effect.fail(parsed);
    }
    return parsed;
  });
}

/** AI 图片生成 API 端点 URL 常量 */
const QWEN_IMAGE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const OPENAI_IMAGE_API_URL = 'https://api.openai.com/v1/images/generations';
const STABILITY_IMAGE_API_URL = 'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image';
const GLM_IMAGE_API_URL = 'https://open.bigmodel.cn/api/paas/v4/images/generations';

/** Qwen provider 默认图片尺寸（使用 '*' 分隔符） */
const DEFAULT_IMAGE_SIZE_QWEN = '1024*1024';
/** 默认图片宽高（用于 Stability AI 解析后的 fallback） */
const DEFAULT_IMAGE_DIMENSION = 1024;

/** Stability AI 默认推理参数 */
const STABILITY_DEFAULT_CFG_SCALE = 7;
const STABILITY_DEFAULT_STEPS = 30;

/** GLM 尺寸映射表 — 仅保留需要转换的尺寸，其余走 fallback */
const GLM_SIZE_MAP: Partial<Record<string, string>> = {
  '1024x768': '768x1344',
  '1344x768': '768x1344',
  '768x1024': '1024x1344',
  '1152x864': '864x1152',
  '864x1152': '864x1152',
};

/** Provider 配置表（模块级常量，避免每次调用重建） */
const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  qwen: {
    apiKeyField: 'qwenApiKey',
    missingKeyMsg: '通义千问 API Key 未配置',
    buildRequest: (_prompt, options) => ({
      url: QWEN_IMAGE_API_URL,
      headers: { ...JSON_CONTENT_HEADERS },
      body: {
        model: 'wanx-v1',
        input: { prompt: _prompt },
        parameters: {
          size: options.size ?? DEFAULT_IMAGE_SIZE_QWEN,
          n: options.count ?? 1,
        },
      },
    }),
    parseResponse: (result) => {
      const output = result.output as Record<string, unknown> | undefined;
      const results = output?.results as Array<{ url: string }> | undefined;
      return {
        images: (results ?? []).map(r => r.url),
        taskId: String(result.request_id ?? ''),
      };
    },
  },
  dalle: {
    apiKeyField: 'dalleApiKey',
    missingKeyMsg: 'DALL-E API Key 未配置',
    buildRequest: (_prompt, options) => ({
      url: OPENAI_IMAGE_API_URL,
      headers: { ...JSON_CONTENT_HEADERS },
      body: {
        model: 'dall-e-3',
        prompt: _prompt,
        n: 1,
        size: options.size ?? DEFAULT_IMAGE_SIZE,
      },
    }),
    parseResponse: (result) => ({
      images: ((result.data as Array<{ url: string }>) ?? []).map(item => item.url),
      taskId: String(result.created ?? ''),
    }),
  },
  stability: {
    apiKeyField: 'stabilityApiKey',
    missingKeyMsg: 'Stability AI API Key 未配置',
    buildRequest: (_prompt, options) => {
      const parts = (options.size ?? DEFAULT_IMAGE_SIZE).split('x').map(Number);
      const rawWidth = parts[0];
      const rawHeight = parts[1];
      /** 显式 NaN/undefined 防护：非法 size 格式回退到默认值 */
      const width = rawWidth === undefined || Number.isNaN(rawWidth) || rawWidth <= 0 ? DEFAULT_IMAGE_DIMENSION : rawWidth;
      const height = rawHeight === undefined || Number.isNaN(rawHeight) || rawHeight <= 0 ? DEFAULT_IMAGE_DIMENSION : rawHeight;
      return {
        url: STABILITY_IMAGE_API_URL,
        headers: { ...JSON_CONTENT_HEADERS, Accept: 'application/json' },
        body: {
          text_prompts: [{ text: _prompt }],
          cfg_scale: STABILITY_DEFAULT_CFG_SCALE,
          height,
          width,
          steps: STABILITY_DEFAULT_STEPS,
          samples: options.count ?? 1,
        },
      };
    },
    parseResponse: (result) => ({
      images: ((result.artifacts as Array<{ base64: string }>) ?? []).map(
        item => `data:image/png;base64,${item.base64}`,
      ),
      taskId: String(result.request_id ?? ''),
    }),
  },
  glm: {
    apiKeyField: 'glmApiKey',
    missingKeyMsg: '智谱 GLM API Key 未配置',
    buildRequest: (_prompt, options) => ({
      url: GLM_IMAGE_API_URL,
      headers: { ...JSON_CONTENT_HEADERS },
      body: {
        model: 'cogview-3-plus',
        prompt: _prompt,
        size: GLM_SIZE_MAP[options.size ?? DEFAULT_IMAGE_SIZE] ?? DEFAULT_IMAGE_SIZE,
        n: options.count ?? 1,
      },
    }),
    parseResponse: (result) => {
      const error = result.error as Record<string, unknown> | undefined;
      if (error) {
        const msg = typeof error.message === 'string' ? error.message : JSON.stringify(error);
        return MsgError.msg(`智谱 GLM 生成失败: ${msg}`);
      }
      return {
        images: ((result.data as Array<{ url: string }>) ?? []).map(item => item.url),
        taskId: String(result.id ?? Date.now()),
      };
    },
    extractErrorDetail: (response) =>
      Effect.tryPromise({
        try: () => response.text(),
        catch: (_error) => `提取错误详情失败: ${String(_error)}`,
      }),
  },
};

/**
 * 获取 Provider 配置
 */
function getProviderConfig(provider: string): ProviderConfig | null {
  return PROVIDER_CONFIGS[provider] ?? null;
}
