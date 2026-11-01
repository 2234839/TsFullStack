import { Cache, Context, Duration, Effect } from 'effect';
import { AuthContext } from '../Context/Auth';
import { ReqCtxService } from '../Context/ReqCtx';
import { DbClientEffect } from './DbService';
import { AppConfigService } from './AppConfig';
import { dbTry, dbTryOrDefault } from '../util/dbEffect';
import { fail, MsgError, requireOrFail, extractErrorMessage } from '../util/error';
import { AIModel as AIModelConfig, OpenAIRequest, OpenAIResponse } from '../types/ai';
import { MS_PER_MINUTE, MS_PER_HOUR, MS_PER_DAY, JSON_CONTENT_HEADERS, MSG } from '../util/constants';
import { withFetchTimeout, FETCH_TIMEOUTS } from '../util/http';

/** 匿名用户频率限制 */
const ANONYMOUS_RPM_LIMIT = 30;
const ANONYMOUS_RPH_LIMIT = 300;
const ANONYMOUS_RPD_LIMIT = 1000;

/** API调用日志保留天数 */
const AI_CALL_LOG_RETENTION_DAYS = 30;

/** 模型列表缓存 TTL（5 分钟，模型变更频率极低） */
const MODEL_CACHE_TTL_MS = 5 * MS_PER_MINUTE;

/** 模型列表内存缓存（Effect Cache，5 分钟 TTL 自动失效） */
const modelsCache = Effect.runSync(
  Cache.make<string, AIModelConfig[], Error | MsgError, ReqCtxService | AppConfigService, 'lookup'>({
    capacity: 1,
    timeToLive: Duration.millis(MODEL_CACHE_TTL_MS),
    requireServicesAt: 'lookup',
    lookup: () =>
      Effect.flatMap(DbClientEffect, (dbClient) =>
        Effect.map(
          dbTry(LOG_PREFIX, '获取AI模型列表', () =>
            dbClient.aiModel.findMany({
              where: { enabled: true },
              orderBy: { weight: 'desc' },
            }),
          ),
          (models) =>
            models.map((model) => ({
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
              /** 登录用户免费可用标注：免费代理只在此标注的模型中选 */
              freeForLoginUser: model.freeForLoginUser,
            })),
        ),
      ),
  }),
);

/** 频率限制检查结果 */
interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
}

/** 检查三项频率限制是否超标 */
function checkLimits(
  counts: readonly [number, number, number],
  limits: readonly [number, number, number],
  labels: readonly [string, string, string],
): RateLimitCheck | null {
  const [rpmCount, rphCount, rpdCount] = counts;
  const [rpmLimit, rphLimit, rpdLimit] = limits;
  if (rpmCount >= rpmLimit) return { allowed: false, reason: `${labels[0]}超限`, retryAfter: MS_PER_MINUTE / 1000 };
  if (rphCount >= rphLimit) return { allowed: false, reason: `${labels[1]}超限`, retryAfter: MS_PER_HOUR / 1000 };
  if (rpdCount >= rpdLimit) return { allowed: false, reason: `${labels[2]}超限`, retryAfter: MS_PER_DAY / 1000 };
  return null;
}

/** 日志前缀 */
const LOG_PREFIX = '[AIProxy]';

/** AI 代理服务工具类 */
class AIProxyServiceUtils {
  /** 检查频率限制 */
  static checkRateLimit = (clientIp: string, userId: string | null, aiModelId: number) =>
    Effect.gen(function* () {
      const dbClient = yield* DbClientEffect;

      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - MS_PER_MINUTE);
      const oneHourAgo = new Date(now.getTime() - MS_PER_HOUR);
      const oneDayAgo = new Date(now.getTime() - MS_PER_DAY);

      const aiModel = yield* dbTry(LOG_PREFIX, '查询AI模型', () =>
        dbClient.aiModel.findUnique({ where: { id: aiModelId } }),
      );
      if (!aiModel || !aiModel.enabled) {
        return { allowed: false, reason: 'AI模型不存在或已禁用' };
      }

      /** 用单次 SQL 条件聚合替代 3 次 COUNT 查询（3 次 DB 往返 → 1 次） */
      /** 所有动态值必须通过 Prisma ${} 占位符参数化，禁止字符串拼接防 SQL 注入 */
      const rawCounts = yield* dbTryOrDefault(
        LOG_PREFIX,
        '查询频率限制计数',
        async () => {
          const rows = await dbClient.$queryRaw<{ rpm: number; rph: number; rpd: number }[]>`
          SELECT
            SUM(CASE WHEN "timestamp" >= ${oneMinuteAgo.toISOString()} THEN 1 ELSE 0 END) AS rpm,
            SUM(CASE WHEN "timestamp" >= ${oneHourAgo.toISOString()} THEN 1 ELSE 0 END) AS rph,
            SUM(CASE WHEN "timestamp" >= ${oneDayAgo.toISOString()} THEN 1 ELSE 0 END) AS rpd
          FROM "AiCallLog"
          WHERE ${userId ? `"userId" = ${userId} AND "aiModelId" = ${aiModelId}` : `"clientIp" = ${clientIp}`}
        `;
          return rows[0] ?? { rpm: 0, rph: 0, rpd: 0 };
        },
        { rpm: 0, rph: 0, rpd: 0 },
      );
      const counts: [number, number, number] = [rawCounts.rpm ?? 0, rawCounts.rph ?? 0, rawCounts.rpd ?? 0];

      const limits = !userId
        ? ([ANONYMOUS_RPM_LIMIT, ANONYMOUS_RPH_LIMIT, ANONYMOUS_RPD_LIMIT] as const)
        : ([aiModel.rpmLimit, aiModel.rphLimit, aiModel.rpdLimit] as const);

      const labels = !userId
        ? (['未登录用户每分钟调用次数', '未登录用户每小时调用次数', '未登录用户每日调用次数'] as const)
        : (['用户每分钟调用次数', '用户每小时调用次数', '用户每日调用次数'] as const);

      const exceeded = checkLimits(counts, limits, labels);
      if (exceeded) return exceeded;

      return { allowed: true };
    });

  /** 记录API调用 */
  static recordApiCall = (params: {
    clientIp: string;
    userId: string | null;
    aiModelId: number;
    modelName: string;
    inputTokens?: number;
    outputTokens?: number;
    success?: boolean;
  }) =>
    Effect.flatMap(DbClientEffect, (dbClient) =>
      dbTry(LOG_PREFIX, '记录API调用', () =>
        dbClient.aiCallLog.create({
          data: {
            clientIp: params.clientIp,
            userId: params.userId,
            aiModelId: params.aiModelId,
            modelName: params.modelName,
            inputTokens: params.inputTokens,
            outputTokens: params.outputTokens,
            success: params.success ?? true,
            timestamp: new Date(),
          },
        }),
      ),
    );

  /** 获取可用的AI模型列表（带 5 分钟内存缓存） */
  static getAvailableModels = () => Cache.get(modelsCache, 'models');

  /** 选择AI模型（负载均衡，纯同步函数） */
  static selectModel = (models: AIModelConfig[]): AIModelConfig | null => {
    if (models.length === 0) {
      return null;
    }

    if (models.length === 1) {
      return models[0]!;
    }

    /** 加权随机选择 */
    const totalWeight = models.reduce((sum, model) => sum + model.weight, 0);
    let random = Math.random() * totalWeight;

    for (const model of models) {
      random -= model.weight;
      if (random <= 0) {
        return model;
      }
    }
    return models[models.length - 1]!;
  };

  /** 调用 OpenAI API（单模型直调） */
  static callOpenAI = (request: OpenAIRequest, aiModel: AIModelConfig) =>
    Effect.gen(function* () {
      const response = yield* openAIUpstreamFetch(
        aiModel,
        buildOpenAIRequestBody(request, aiModel, request.stream ?? false),
        '[AIProxy]·上游请求(连接+上游排队+首包)',
      );

      if (!response.ok) {
        const errorText = yield* Effect.promise(() => response.text()).pipe(
          Effect.withSpan('[AIProxy]·读取上游错误响应'),
        );
        return yield* fail(`OpenAI API错误: ${response.status} - ${errorText}`);
      }

      /** 读取并解析完整响应体（非流式：上游生成完整 JSON 后一次性返回） */
      return yield* Effect.promise(() => response.json() as Promise<OpenAIResponse>).pipe(
        Effect.withSpan('[AIProxy]·读取响应(上游生成完整JSON)'),
      );
    });

  /** 代理OpenAI请求（非流式）：按权重单选模型直调，不做换模型重试 */
  static proxyOpenAIRequest = (request: OpenAIRequest, clientIp: string) =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;
      const currentUserId = auth.user?.id ?? null;

      // 获取可用模型：只允许后台标注为「登录用户免费可用」的模型走免费代理，未标注的一律拒绝
      const availableModels = (yield* AIProxyServiceUtils.getAvailableModels()).filter((m) => m.freeForLoginUser);
      if (availableModels.length === 0) {
        return yield* fail(MSG.NO_AI_MODEL_AVAILABLE);
      }

      const selectedModel = yield* requireOrFail(AIProxyServiceUtils.selectModel(availableModels), '模型选择失败');

      // 检查频率限制
      const rateLimitCheck = yield* AIProxyServiceUtils.checkRateLimit(clientIp, currentUserId, selectedModel.id);
      if (!rateLimitCheck.allowed) {
        yield* AIProxyServiceUtils.recordApiCall({
          clientIp,
          userId: currentUserId,
          aiModelId: selectedModel.id,
          modelName: selectedModel.model,
          success: false,
        });
        return yield* fail(rateLimitCheck.reason ?? '请求频率超限');
      }

      const response = yield* openAIUpstreamFetch(
        selectedModel,
        buildOpenAIRequestBody(request, selectedModel, request.stream ?? false),
        '[AIProxy]·上游请求(连接+上游排队+首包)',
      );
      const base = { clientIp, userId: currentUserId, aiModelId: selectedModel.id, modelName: selectedModel.model };

      if (!response.ok) {
        const errorText = yield* Effect.promise(() => response.text()).pipe(
          Effect.withSpan('[AIProxy]·读取上游错误响应'),
        );
        yield* AIProxyServiceUtils.recordApiCall({ ...base, success: false });
        return yield* fail(`OpenAI API错误: ${response.status} - ${errorText}`);
      }

      /** 读取并解析完整响应体（非流式：上游生成完整 JSON 后一次性返回） */
      const data = yield* Effect.promise(() => response.json() as Promise<OpenAIResponse>).pipe(
        Effect.withSpan('[AIProxy]·读取响应(上游生成完整JSON)'),
      );
      yield* AIProxyServiceUtils.recordApiCall({
        ...base,
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
        success: true,
      });
      return data;
    }).pipe(Effect.withSpan('[AIProxy]·免费代理(非流式)'));

  /**
   * 流式代理 OpenAI 请求：返回上游 SSE 行的异步迭代器（逐行透传，不做内容解析）。
   * RPC 框架检测到 AsyncIterable 返回值后自动切换为 SSE 分帧传输。
   * 记账在流建立时即落一条（流式响应无法拿到完整 usage，token 数不记录）。
   */
  static proxyOpenAIStreamRequest = (
    request: OpenAIRequest,
    clientIp: string,
  ): Effect.Effect<AsyncIterable<string>, Error, AppConfigService | AuthContext | ReqCtxService> =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;
      const currentUserId = auth.user?.id ?? null;

      const availableModels = (yield* AIProxyServiceUtils.getAvailableModels()).filter((m) => m.freeForLoginUser);
      if (availableModels.length === 0) {
        return yield* fail(MSG.NO_AI_MODEL_AVAILABLE);
      }

      const selectedModel = yield* requireOrFail(AIProxyServiceUtils.selectModel(availableModels), '模型选择失败');

      const rateLimitCheck = yield* AIProxyServiceUtils.checkRateLimit(clientIp, currentUserId, selectedModel.id);
      if (!rateLimitCheck.allowed) {
        yield* AIProxyServiceUtils.recordApiCall({
          clientIp,
          userId: currentUserId,
          aiModelId: selectedModel.id,
          modelName: selectedModel.model,
          success: false,
        });
        return yield* fail(rateLimitCheck.reason ?? '请求频率超限');
      }

      /** 阶段 1：连接 + 上游排队 + 模型排队（到响应头返回为止；SSE 响应头在首 token 就绪前即返回） */
      const response = yield* openAIUpstreamFetch(
        selectedModel,
        buildOpenAIRequestBody(request, selectedModel, true),
        '[AIProxy]·上游流建立(连接+上游排队)',
      );

      if (!response.ok || !response.body) {
        const errorText = yield* Effect.promise(() => (response.body ? response.text() : Promise.resolve(''))).pipe(
          Effect.withSpan('[AIProxy]·读取上游错误响应'),
        );
        return yield* fail(`OpenAI API错误: ${response.status} - ${errorText}`);
      }

      /** 首帧打点基准：流建立完成时刻 */
      const streamOpenedAt = Date.now();

      /** 流建立即记账（成功、无 token 统计）：与限额失败路径保持对称，保证频控计数完整 */
      yield* AIProxyServiceUtils.recordApiCall({
        clientIp,
        userId: currentUserId,
        aiModelId: selectedModel.id,
        modelName: selectedModel.model,
        success: true,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      /** 首帧打点：首帧时刻 - 流建立完成时刻 = 上游真正开始吐 token 的排队耗时（打点无法进 span，走日志） */
      let firstLineAt = 0;
      /** 上游 SSE 行生成器：逐行透传（SSE 行天然不含换行，可安全作为本端 SSE 帧载荷） */
      const lines = async function* (): AsyncGenerator<string> {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (firstLineAt === 0) {
              firstLineAt = Date.now();
              console.log(`[AIProxy] 上游首帧到达（流建立后 ${firstLineAt - streamOpenedAt}ms）`);
            }
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n');
            buffer = parts.pop() ?? '';
            for (const part of parts) {
              const trimmed = part.trim();
              if (trimmed) yield trimmed;
            }
          }
          const rest = buffer.trim();
          if (rest) yield rest;
        } finally {
          /** 客户端断开/提前终止时释放上游连接 */
          await reader.cancel().catch(() => {});
        }
      };
      return lines();
    }).pipe(Effect.withSpan('[AIProxy]·免费代理流式(至流建立)'));

  /** 清理过期的API调用记录（30天前） */
  static cleanupExpiredApiLogs = () =>
    Effect.gen(function* () {
      const dbClient = yield* DbClientEffect;
      const thirtyDaysAgo = new Date(Date.now() - AI_CALL_LOG_RETENTION_DAYS * MS_PER_DAY);
      const result = yield* dbTry(LOG_PREFIX, '清理过期API调用记录', () =>
        dbClient.aiCallLog.deleteMany({
          where: { timestamp: { lt: thirtyDaysAgo } },
        }),
      );
      return {
        success: true as const,
        deletedCount: result.count,
        message: `成功清理 ${result.count} 条过期记录`,
      };
    });
}

/** 构建 chat/completions 请求体（非流式与流式共用） */
function buildOpenAIRequestBody(
  request: OpenAIRequest,
  aiModel: AIModelConfig,
  /** 是否流式（SSE）请求 */
  stream: boolean,
): Record<string, unknown> {
  const requestBody: Record<string, unknown> = {
    model: aiModel.model,
    messages: request.messages,
    temperature: request.temperature ?? aiModel.temperature,
    max_tokens: request.max_tokens ?? aiModel.maxTokens,
    stream,
    thinking: request.thinking ?? { type: 'disabled' },
  };
  if (request.tools && request.tools.length > 0) {
    requestBody.tools = request.tools;
    if (request.tool_choice !== undefined) {
      requestBody.tool_choice = request.tool_choice;
    }
  }
  return requestBody;
}

/** 发起上游请求（到响应头为止，不检查 ok；429 等瞬时失败的换模型重试由调用方决策） */
function openAIUpstreamFetch(
  aiModel: AIModelConfig,
  requestBody: Record<string, unknown>,
  /** Tracer 埋点 span 名（非流式/流式阶段命名不同） */
  spanName: string,
): Effect.Effect<Response, Error | MsgError> {
  return Effect.tryPromise({
    try: async () =>
      fetch(
        `${aiModel.baseUrl}/chat/completions`,
        withFetchTimeout(
          {
            method: 'POST',
            headers: {
              ...JSON_CONTENT_HEADERS,
              Authorization: `Bearer ${aiModel.apiKey}`,
            },
            body: JSON.stringify(requestBody),
          },
          FETCH_TIMEOUTS.openaiProxy,
        ),
      ),
    catch: (error) => MsgError.msg(`调用OpenAI API失败: ${extractErrorMessage(error)}`),
  }).pipe(Effect.withSpan(spanName, { attributes: { model: aiModel.model, baseUrl: aiModel.baseUrl } }));
}

/** AI 代理服务 Tag */
export class AIProxyService extends Context.Service<
  AIProxyService,
  {
    /** 检查频率限制 */
    checkRateLimit: (
      clientIp: string,
      userId: string | null,
      aiModelId: number,
    ) => Effect.Effect<RateLimitCheck, Error, AppConfigService | ReqCtxService>;

    /** 记录API调用 */
    recordApiCall: (params: {
      clientIp: string;
      userId: string | null;
      aiModelId: number;
      modelName: string;
      inputTokens?: number;
      outputTokens?: number;
      success?: boolean;
    }) => Effect.Effect<void, Error, AppConfigService | ReqCtxService>;

    /** 获取可用的AI模型列表 */
    getAvailableModels: () => Effect.Effect<AIModelConfig[], Error, AppConfigService | ReqCtxService>;

    /** 选择AI模型（负载均衡，纯同步） */
    selectModel: (models: AIModelConfig[]) => AIModelConfig | null;

    /** 调用OpenAI API */
    callOpenAI: (request: OpenAIRequest, aiModel: AIModelConfig) => Effect.Effect<OpenAIResponse, Error, never>;

    /** 代理OpenAI请求 */
    proxyOpenAIRequest: (
      request: OpenAIRequest,
      clientIp: string,
    ) => Effect.Effect<OpenAIResponse, Error, AppConfigService | AuthContext | ReqCtxService>;

    /** 流式代理OpenAI请求（返回上游 SSE 行的异步迭代器） */
    proxyOpenAIStreamRequest: (
      request: OpenAIRequest,
      clientIp: string,
    ) => Effect.Effect<AsyncIterable<string>, Error, AppConfigService | AuthContext | ReqCtxService>;

    /** 清理过期的API调用记录 */
    cleanupExpiredApiLogs: () => Effect.Effect<
      { success: boolean; deletedCount: number; message: string },
      Error,
      AppConfigService | ReqCtxService
    >;
  }
>()('AIProxyService') {}

/** AI 代理服务实现（v4 Service 接口仍保留 .of 包装方法） */
export const AIProxyServiceLive = AIProxyService.of({
  checkRateLimit: AIProxyServiceUtils.checkRateLimit,
  recordApiCall: AIProxyServiceUtils.recordApiCall,
  getAvailableModels: AIProxyServiceUtils.getAvailableModels,
  selectModel: AIProxyServiceUtils.selectModel,
  callOpenAI: AIProxyServiceUtils.callOpenAI,
  proxyOpenAIRequest: AIProxyServiceUtils.proxyOpenAIRequest,
  proxyOpenAIStreamRequest: AIProxyServiceUtils.proxyOpenAIStreamRequest,
  cleanupExpiredApiLogs: AIProxyServiceUtils.cleanupExpiredApiLogs,
});
