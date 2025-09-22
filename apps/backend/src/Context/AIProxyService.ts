import { Context, Effect } from 'effect';
import { PrismaService } from '../Context/PrismaService';
import { AppConfigService } from '../Context/AppConfig';
import { AuthContext } from '../Context/Auth';
import { Prisma } from '@prisma/client';

/** OpenAI API 请求接口 */
interface OpenAIRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/** OpenAI API 响应接口 */
interface OpenAIResponse {
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
interface AIModelConfig {
  id: number;
  name: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  enabled: boolean;
  weight: number;
  rpmLimit: number;
  rphLimit: number;
  rpdLimit: number;
}

/** 频率限制检查结果 */
interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
}

/** AI 代理服务工具类 */
export class AIProxyServiceUtils {
  /** 检查频率限制 */
  static checkRateLimit = (
    clientIp: string,
    userId: string | null,
    aiModelId: number,
  ): Effect.Effect<RateLimitCheck, Error, PrismaService> =>
    Effect.gen(function* () {
      const prismaService = yield* PrismaService;

      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // 获取模型配置
      const aiModel = yield* Effect.tryPromise({
        try: () =>
          prismaService.prisma.aiModel.findUnique({
            where: { id: aiModelId },
          }),
        catch: () => new Error('AI模型不存在'),
      });

      if (!aiModel || !aiModel.enabled) {
        return { allowed: false, reason: 'AI模型不存在或已禁用' };
      }

      // 彻底优化：使用单次查询获取所有时间窗口的计数数据

      if (!userId) {
        // 未登录用户：检查IP限制 - 使用Prisma查询优化性能
        const [globalRpmCount, globalRphCount, globalRpdCount] = yield* Effect.all([
          Effect.promise(() =>
            prismaService.prisma.apiRateLimit.count({
              where: {
                clientIp,
                timestamp: { gte: oneMinuteAgo },
              },
            })
          ).pipe(Effect.catchAll(() => Effect.succeed(0))),
          Effect.promise(() =>
            prismaService.prisma.apiRateLimit.count({
              where: {
                clientIp,
                timestamp: { gte: oneHourAgo },
              },
            })
          ).pipe(Effect.catchAll(() => Effect.succeed(0))),
          Effect.promise(() =>
            prismaService.prisma.apiRateLimit.count({
              where: {
                clientIp,
                timestamp: { gte: oneDayAgo },
              },
            })
          ).pipe(Effect.catchAll(() => Effect.succeed(0))),
        ]);

        // 未登录用户限制（固定值）
        const anonymousRpmLimit = 30;
        const anonymousRphLimit = 300;
        const anonymousRpdLimit = 1000;

        if (globalRpmCount >= anonymousRpmLimit) {
          return { allowed: false, reason: '未登录用户每分钟调用次数超限', retryAfter: 60 };
        }
        if (globalRphCount >= anonymousRphLimit) {
          return { allowed: false, reason: '未登录用户每小时调用次数超限', retryAfter: 3600 };
        }
        if (globalRpdCount >= anonymousRpdLimit) {
          return { allowed: false, reason: '未登录用户每日调用次数超限', retryAfter: 86400 };
        }
      } else {
        // 已登录用户：检查用户特定限制 - 使用Prisma查询优化性能
        const [userRpmCount, userRphCount, userRpdCount] = yield* Effect.all([
          Effect.promise(() =>
            prismaService.prisma.apiRateLimit.count({
              where: {
                userId,
                aiModelId,
                timestamp: { gte: oneMinuteAgo },
              },
            })
          ).pipe(Effect.catchAll(() => Effect.succeed(0))),
          Effect.promise(() =>
            prismaService.prisma.apiRateLimit.count({
              where: {
                userId,
                aiModelId,
                timestamp: { gte: oneHourAgo },
              },
            })
          ).pipe(Effect.catchAll(() => Effect.succeed(0))),
          Effect.promise(() =>
            prismaService.prisma.apiRateLimit.count({
              where: {
                userId,
                aiModelId,
                timestamp: { gte: oneDayAgo },
              },
            })
          ).pipe(Effect.catchAll(() => Effect.succeed(0))),
        ]);

        if (userRpmCount >= aiModel.rpmLimit) {
          return { allowed: false, reason: '用户每分钟调用次数超限', retryAfter: 60 };
        }
        if (userRphCount >= aiModel.rphLimit) {
          return { allowed: false, reason: '用户每小时调用次数超限', retryAfter: 3600 };
        }
        if (userRpdCount >= aiModel.rpdLimit) {
          return { allowed: false, reason: '用户每日调用次数超限', retryAfter: 86400 };
        }
      }

      return { allowed: true };
    });

  /** 记录API调用 */
  static recordApiCall = (
    clientIp: string,
    userId: string | null,
    aiModelId: number,
  ): Effect.Effect<void, Error, PrismaService> =>
    Effect.gen(function* () {
      const prismaService = yield* PrismaService;

      yield* Effect.tryPromise({
        try: () =>
          prismaService.prisma.apiRateLimit.create({
            data: {
              clientIp,
              userId,
              aiModelId,
              timestamp: new Date(),
            },
          }),
        catch: (error) => new Error(`记录API调用失败: ${error}`),
      });
    });

  /** 获取可用的AI模型列表 */
  static getAvailableModels = (): Effect.Effect<AIModelConfig[], Error, PrismaService> =>
    Effect.gen(function* () {
      const prismaService = yield* PrismaService;

      const models = yield* Effect.tryPromise({
        try: () =>
          prismaService.prisma.aiModel.findMany({
            where: { enabled: true },
            orderBy: { weight: 'desc' },
          }),
        catch: (error) => new Error(`获取AI模型失败: ${error}`),
      });

      return models.map((model: any) => ({
        id: model.id,
        name: model.name,
        model: model.model,
        baseUrl: model.baseUrl,
        apiKey: model.apiKey,
        maxTokens: model.maxTokens,
        temperature: model.temperature,
        enabled: model.enabled,
        weight: model.weight,
        rpmLimit: model.rpmLimit,
        rphLimit: model.rphLimit,
        rpdLimit: model.rpdLimit,
      }));
    });

  /** 选择AI模型（负载均衡） */
  static selectModel = (
    models: AIModelConfig[],
  ): Effect.Effect<AIModelConfig | null, never, never> => {
    if (models.length === 0) {
      return Effect.succeed(null);
    }

    if (models.length === 1) {
      return Effect.succeed(models[0]!);
    }

    // 加权随机选择
    const totalWeight = models.reduce((sum, model) => sum + model.weight, 0);
    let random = Math.random() * totalWeight;

    for (const model of models) {
      random -= model.weight;
      if (random <= 0) {
        return Effect.succeed(model);
      }
    }
    return Effect.succeed(models[models.length - 1]!);
  }

  /** 调用OpenAI API */
  static callOpenAI = (
    request: OpenAIRequest,
    aiModel: AIModelConfig,
  ): Effect.Effect<OpenAIResponse, Error, never> =>
    Effect.tryPromise({
      try: async () => {
        const url = `${aiModel.baseUrl}/chat/completions`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiModel.apiKey}`,
          },
          body: JSON.stringify({
            model: aiModel.model,
            messages: request.messages,
            temperature: request.temperature ?? aiModel.temperature,
            max_tokens: request.max_tokens ?? aiModel.maxTokens,
            stream: request.stream ?? false,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI API错误: ${response.status} - ${errorText}`);
        }

        return response.json() as Promise<OpenAIResponse>;
      },
      catch: (error) => new Error(`调用OpenAI API失败: ${error instanceof Error ? error.message : String(error)}`),
    });

  /** 代理OpenAI请求 */
  static proxyOpenAIRequest = (
    request: OpenAIRequest,
    clientIp: string,
    userId: string | null,
  ): Effect.Effect<OpenAIResponse, Error, PrismaService | AuthContext> =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;
      const currentUserId = auth.user?.id || null;

      // 获取可用模型
      const availableModels = yield* AIProxyServiceUtils.getAvailableModels();
      if (availableModels.length === 0) {
        throw new Error('没有可用的AI模型');
      }

      // 选择模型
      const selectedModel = yield* AIProxyServiceUtils.selectModel(availableModels);
      if (!selectedModel) {
        throw new Error('无法选择AI模型');
      }

      // 检查频率限制
      const rateLimitCheck = yield* AIProxyServiceUtils.checkRateLimit(clientIp, currentUserId, selectedModel.id);
      if (!rateLimitCheck.allowed) {
        throw new Error(rateLimitCheck.reason || '请求频率超限');
      }

      // 记录API调用
      yield* AIProxyServiceUtils.recordApiCall(clientIp, currentUserId, selectedModel.id);

      // 调用OpenAI API
      return yield* AIProxyServiceUtils.callOpenAI(request, selectedModel);
    });

  /** 清理过期的频率限制记录 */
  static cleanupExpiredRateLimits = (): Effect.Effect<void, Error, PrismaService> =>
    Effect.gen(function* () {
      const prismaService = yield* PrismaService;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      yield* Effect.tryPromise({
        try: () =>
          prismaService.prisma.apiRateLimit.deleteMany({
            where: {
              timestamp: { lt: thirtyDaysAgo },
            },
          }),
        catch: () => new Error('清理过期记录失败'),
      });
    });
}

/** AI 代理服务 Tag */
export class AIProxyService extends Context.Tag('AIProxyService')<
  AIProxyService,
  {
    /** 检查频率限制 */
    checkRateLimit: (
      clientIp: string,
      userId: string | null,
      aiModelId: number,
    ) => Effect.Effect<RateLimitCheck, Error, PrismaService>;

    /** 记录API调用 */
    recordApiCall: (
      clientIp: string,
      userId: string | null,
      aiModelId: number,
    ) => Effect.Effect<void, Error, PrismaService>;

    /** 获取可用的AI模型列表 */
    getAvailableModels: () => Effect.Effect<AIModelConfig[], Error, PrismaService>;

    /** 选择AI模型（负载均衡） */
    selectModel: (
      models: AIModelConfig[],
    ) => Effect.Effect<AIModelConfig | null, never, never>;

    /** 调用OpenAI API */
    callOpenAI: (
      request: OpenAIRequest,
      aiModel: AIModelConfig,
    ) => Effect.Effect<OpenAIResponse, Error, never>;

    /** 代理OpenAI请求 */
    proxyOpenAIRequest: (
      request: OpenAIRequest,
      clientIp: string,
      userId: string | null,
    ) => Effect.Effect<OpenAIResponse, Error, PrismaService | AuthContext>;

    /** 清理过期的频率限制记录 */
    cleanupExpiredRateLimits: () => Effect.Effect<void, Error, PrismaService>;
  }
>() {}

/** AI 代理服务实现 */
export const AIProxyServiceLive = AIProxyService.of({
  checkRateLimit: AIProxyServiceUtils.checkRateLimit,
  recordApiCall: AIProxyServiceUtils.recordApiCall,
  getAvailableModels: AIProxyServiceUtils.getAvailableModels,
  selectModel: AIProxyServiceUtils.selectModel,
  callOpenAI: AIProxyServiceUtils.callOpenAI,
  proxyOpenAIRequest: AIProxyServiceUtils.proxyOpenAIRequest,
  cleanupExpiredRateLimits: AIProxyServiceUtils.cleanupExpiredRateLimits,
});