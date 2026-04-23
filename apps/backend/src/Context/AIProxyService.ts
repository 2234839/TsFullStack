import { Context, Effect } from 'effect';
import { AuthContext } from '../Context/Auth';
import { ReqCtxService } from '../Context/ReqCtx';
import { DbClientEffect } from './DbService';
import { AppConfigService } from './AppConfig';
import { dbTry, dbTryOrDefault } from '../util/dbEffect';
import { fail, neverReturn, MsgError } from '../util/error';
import { AIModel as AIModelConfig, OpenAIRequest, OpenAIResponse } from '../types/ai';
import { MS_PER_MINUTE, MS_PER_HOUR, MS_PER_DAY } from '../util/constants';
import { withFetchTimeout, FETCH_TIMEOUTS } from '../util/http';

/** 匿名用户频率限制 */
const ANONYMOUS_RPM_LIMIT = 30;
const ANONYMOUS_RPH_LIMIT = 300;
const ANONYMOUS_RPD_LIMIT = 1000;

/** API调用日志保留天数 */
const AI_CALL_LOG_RETENTION_DAYS = 30;

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

/** AI 代理服务工具类 */
export class AIProxyServiceUtils {
  /** 检查频率限制 */
  static checkRateLimit = (
    clientIp: string,
    userId: string | null,
    aiModelId: number,
  ): Effect.Effect<RateLimitCheck, Error, AppConfigService | ReqCtxService> =>
    Effect.gen(function* () {
      const dbClient = yield* DbClientEffect;

      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - MS_PER_MINUTE);
      const oneHourAgo = new Date(now.getTime() - MS_PER_HOUR);
      const oneDayAgo = new Date(now.getTime() - MS_PER_DAY);

      const aiModel = yield* dbTry('[AIProxy]', '查询AI模型', () =>
        dbClient.aiModel.findUnique({ where: { id: aiModelId } }),
      );
      if (!aiModel || !aiModel.enabled) {
        return { allowed: false, reason: 'AI模型不存在或已禁用' };
      }

      /** 用单次 SQL 条件聚合替代 3 次 COUNT 查询（3 次 DB 往返 → 1 次） */
      /** 所有动态值必须通过 Prisma ${} 占位符参数化，禁止字符串拼接防 SQL 注入 */
      const rawCounts = yield* dbTryOrDefault('[AIProxy]', '查询频率限制计数', async () => {
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
        ? [ANONYMOUS_RPM_LIMIT, ANONYMOUS_RPH_LIMIT, ANONYMOUS_RPD_LIMIT] as const
        : [aiModel.rpmLimit, aiModel.rphLimit, aiModel.rpdLimit] as const;

      const labels = !userId
        ? ['未登录用户每分钟调用次数', '未登录用户每小时调用次数', '未登录用户每日调用次数'] as const
        : ['用户每分钟调用次数', '用户每小时调用次数', '用户每日调用次数'] as const;

      const exceeded = checkLimits(counts, limits, labels);
      if (exceeded) return exceeded;

      return { allowed: true };
    });

  /** 记录API调用 */
  static recordApiCall = (
    clientIp: string,
    userId: string | null,
    aiModelId: number,
    modelName: string,
    inputTokens?: number,
    outputTokens?: number,
    success: boolean = true,
  ): Effect.Effect<void, Error, AppConfigService | ReqCtxService> =>
    Effect.gen(function* () {
      const dbClient = yield* DbClientEffect;

      yield* dbTry('[AIProxy]', '记录API调用', () =>
        dbClient.aiCallLog.create({
          data: {
            clientIp,
            userId,
            aiModelId,
            modelName,
            inputTokens,
            outputTokens,
            success,
            timestamp: new Date(),
          },
        }),
      );
    });

  /** 获取可用的AI模型列表 */
  static getAvailableModels = (): Effect.Effect<AIModelConfig[], Error, AppConfigService | ReqCtxService> =>
    Effect.gen(function* () {
      const dbClient = yield* DbClientEffect;

      const models = yield* dbTry('[AIProxy]', '获取AI模型列表', () =>
        dbClient.aiModel.findMany({
          where: { enabled: true },
          orderBy: { weight: 'desc' },
        }),
      );

      return models.map((model) => ({
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
  };

  /** 调用OpenAI API */
  static callOpenAI = (
    request: OpenAIRequest,
    aiModel: AIModelConfig,
  ): Effect.Effect<OpenAIResponse, Error, never> =>
    Effect.tryPromise({
      try: async () => {
        const url = `${aiModel.baseUrl}/chat/completions`;

        // 构建请求体
        const requestBody: Record<string, unknown> = {
          model: aiModel.model,
          messages: request.messages,
          temperature: request.temperature ?? aiModel.temperature,
          max_tokens: request.max_tokens ?? aiModel.maxTokens,
          stream: request.stream ?? false,
          thinking: request.thinking || {
            type: 'disabled',
          },
        };

        // 如果有 tools 参数，添加到请求中
        if (request.tools && request.tools.length > 0) {
          requestBody.tools = request.tools;
          if (request.tool_choice !== undefined) {
            requestBody.tool_choice = request.tool_choice;
          }
        }

        const response = await fetch(url, withFetchTimeout({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${aiModel.apiKey}`,
          },
          body: JSON.stringify(requestBody),
        }, FETCH_TIMEOUTS.openaiProxy));

        if (!response.ok) {
          const errorText = await response.text();
          throw MsgError.msg(`OpenAI API错误: ${response.status} - ${errorText}`);
        }

        return response.json() as Promise<OpenAIResponse>;
      },
      catch: (error) => {
        /** 保留原始 MsgError 的详细错误信息，避免二次包装丢失 HTTP status 等关键信息 */
        if (MsgError.isMsgError(error)) return error;
        return MsgError.msg(`调用OpenAI API失败: ${error instanceof Error ? error.message : String(error)}`);
      },
    });

  /** 代理OpenAI请求 */
  static proxyOpenAIRequest = (
    request: OpenAIRequest,
    clientIp: string,
  ): Effect.Effect<OpenAIResponse, Error, AppConfigService | AuthContext | ReqCtxService> =>
    Effect.gen(function* () {
      const auth = yield* AuthContext;
      const currentUserId = auth.user?.id || null;

      // 获取可用模型
      const availableModels = yield* AIProxyServiceUtils.getAvailableModels();
      if (availableModels.length === 0) {
        yield* fail('没有可用的AI模型');
        return neverReturn();
      }

      // 选择模型（availableModels 已在上方校验非空，selectModel 对非空数组保证返回非 null）
      const selectedModelRaw = yield* AIProxyServiceUtils.selectModel(availableModels);
      if (!selectedModelRaw) {
        yield* fail('模型选择失败');
        return neverReturn();
      }
      const selectedModel = selectedModelRaw;

      // 检查频率限制
      const rateLimitCheck = yield* AIProxyServiceUtils.checkRateLimit(
        clientIp,
        currentUserId,
        selectedModel.id,
      );
      if (!rateLimitCheck.allowed) {
        // 记录失败的频率限制检查
        yield* AIProxyServiceUtils.recordApiCall(
          clientIp,
          currentUserId,
          selectedModel.id,
          selectedModel.model,
          undefined,
          undefined,
          false,
        );
        yield* fail(rateLimitCheck.reason || '请求频率超限');
        return neverReturn();
      }

      // 调用 OpenAI API — 失败时记录调用并传播错误（yield* 确保 Effect 在正确上下文中执行）
      const response = yield* AIProxyServiceUtils.callOpenAI(request, selectedModel).pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* AIProxyServiceUtils.recordApiCall(
              clientIp, currentUserId, selectedModel.id, selectedModel.model,
              undefined, undefined, false,
            );
            return yield* Effect.fail(error);
          }),
        ),
      );

      // 提取Token使用量
      const inputTokens = response.usage?.prompt_tokens;
      const outputTokens = response.usage?.completion_tokens;

      // 记录成功的API调用
      yield* AIProxyServiceUtils.recordApiCall(
        clientIp,
        currentUserId,
        selectedModel.id,
        selectedModel.model,
        inputTokens,
        outputTokens,
        true,
      );

      return response;
    });

  /** 清理过期的API调用记录（30天前） */
  static cleanupExpiredApiLogs = (): Effect.Effect<
    { success: boolean; deletedCount: number; message: string },
    Error,
    AppConfigService | ReqCtxService
  > =>
    Effect.gen(function* () {
      const dbClient = yield* DbClientEffect;
      const thirtyDaysAgo = new Date(Date.now() - AI_CALL_LOG_RETENTION_DAYS * MS_PER_DAY);

      const result = yield* dbTry('[AIProxy]', '清理过期API调用记录', () =>
        dbClient.aiCallLog.deleteMany({
          where: {
            timestamp: { lt: thirtyDaysAgo },
          },
        }),
      );

      return {
        success: true,
        deletedCount: result.count,
        message: `成功清理 ${result.count} 条过期记录`,
      };
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
    ) => Effect.Effect<RateLimitCheck, Error, AppConfigService | ReqCtxService>;

    /** 记录API调用 */
    recordApiCall: (
      clientIp: string,
      userId: string | null,
      aiModelId: number,
      modelName: string,
      inputTokens?: number,
      outputTokens?: number,
      success?: boolean,
    ) => Effect.Effect<void, Error, AppConfigService | ReqCtxService>;

    /** 获取可用的AI模型列表 */
    getAvailableModels: () => Effect.Effect<AIModelConfig[], Error, AppConfigService | ReqCtxService>;

    /** 选择AI模型（负载均衡） */
    selectModel: (models: AIModelConfig[]) => Effect.Effect<AIModelConfig | null, never, never>;

    /** 调用OpenAI API */
    callOpenAI: (
      request: OpenAIRequest,
      aiModel: AIModelConfig,
    ) => Effect.Effect<OpenAIResponse, Error, never>;

    /** 代理OpenAI请求 */
    proxyOpenAIRequest: (
      request: OpenAIRequest,
      clientIp: string,
    ) => Effect.Effect<OpenAIResponse, Error, AppConfigService | AuthContext | ReqCtxService>;

    /** 清理过期的API调用记录 */
    cleanupExpiredApiLogs: () => Effect.Effect<
      { success: boolean; deletedCount: number; message: string },
      Error,
      AppConfigService | ReqCtxService
    >;
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
  cleanupExpiredApiLogs: AIProxyServiceUtils.cleanupExpiredApiLogs,
});
