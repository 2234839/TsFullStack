import { Effect } from 'effect';
import { AIProxyService } from '../../Context/AIProxyService';
import { requireAdmin } from '../../Context/Auth';
import { reqClientIpEffect } from '../../Context/ClientIPService';
import { ReqCtxService } from '../../Context/ReqCtx';
import { adminDbTry } from '../../util/dbEffect';
import {
  OpenAIRequest as OpenAIProxyRequest,
} from '../../types/ai';
import { evaluateInfoQuality } from './infoQuality';

/** 日志前缀 */
const LOG_PREFIX = '[AiApi]';

/** 默认 AI 模型 */
const DEFAULT_AI_MODEL = 'gpt-3.5-turbo';

/** AI 模型默认参数 */
const DEFAULT_AI_CONFIG = {
  maxTokens: 2000,
  temperature: 0.7,
  weight: 100,
  rpmLimit: 60,
  rphLimit: 1000,
  rpdLimit: 10000,
} as const;

/** 创建AI模型请求 */
export interface CreateAIModelRequest {
  name: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  maxTokens?: number;
  temperature?: number;
  enabled?: boolean;
  weight?: number;
  rpmLimit?: number;
  rphLimit?: number;
  rpdLimit?: number;
  description?: string;
}

/** 更新AI模型请求 */
export interface UpdateAIModelRequest {
  id: number;
  name?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
  enabled?: boolean;
  weight?: number;
  rpmLimit?: number;
  rphLimit?: number;
  rpdLimit?: number;
  description?: string;
}

export const aiApi = {
  evaluateInfoQuality,

  /** 代理OpenAI请求 */
  proxyOpenAI: (request: OpenAIProxyRequest) =>
    Effect.gen(function* () {
      const aiProxyService = yield* AIProxyService;
      const clientIp = yield* reqClientIpEffect;
      return yield* aiProxyService.proxyOpenAIRequest(
        { ...request, model: request.model ?? DEFAULT_AI_MODEL },
        clientIp,
      );
    }),

  /** 获取所有AI模型（管理员） */
  getAIModels: () =>
    adminDbTry(LOG_PREFIX, '获取AI模型', (dbClient) =>
      dbClient.aiModel.findMany({ orderBy: { id: 'asc' } }),
    ),

  /** 创建AI模型（管理员） */
  createAIModel: (request: CreateAIModelRequest) =>
    adminDbTry(LOG_PREFIX, '创建AI模型', (dbClient) =>
      dbClient.aiModel.create({
        data: {
          name: request.name,
          model: request.model,
          baseUrl: request.baseUrl,
          apiKey: request.apiKey,
          maxTokens: request.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens,
          temperature: request.temperature ?? DEFAULT_AI_CONFIG.temperature,
          enabled: request.enabled !== undefined ? request.enabled : true,
          weight: request.weight ?? DEFAULT_AI_CONFIG.weight,
          rpmLimit: request.rpmLimit ?? DEFAULT_AI_CONFIG.rpmLimit,
          rphLimit: request.rphLimit ?? DEFAULT_AI_CONFIG.rphLimit,
          rpdLimit: request.rpdLimit ?? DEFAULT_AI_CONFIG.rpdLimit,
          description: request.description,
        },
      }),
    ),

  /** 更新AI模型（管理员） */
  updateAIModel: (request: UpdateAIModelRequest) =>
    adminDbTry(LOG_PREFIX, '更新AI模型', (dbClient) =>
      dbClient.aiModel.update({
        where: { id: request.id },
        data: {
          ...(request.name !== undefined && { name: request.name }),
          ...(request.model !== undefined && { model: request.model }),
          ...(request.baseUrl !== undefined && { baseUrl: request.baseUrl }),
          ...(request.apiKey !== undefined && { apiKey: request.apiKey }),
          ...(request.maxTokens !== undefined && { maxTokens: request.maxTokens }),
          ...(request.temperature !== undefined && { temperature: request.temperature }),
          ...(request.enabled !== undefined && { enabled: request.enabled }),
          ...(request.weight !== undefined && { weight: request.weight }),
          ...(request.rpmLimit !== undefined && { rpmLimit: request.rpmLimit }),
          ...(request.rphLimit !== undefined && { rphLimit: request.rphLimit }),
          ...(request.rpdLimit !== undefined && { rpdLimit: request.rpdLimit }),
          ...(request.description !== undefined && { description: request.description }),
        },
      }),
    ),

  /** 删除AI模型（管理员） */
  deleteAIModel: (id: number) =>
    Effect.gen(function* () {
      yield* adminDbTry(LOG_PREFIX, '删除AI模型', (dbClient) =>
        dbClient.aiModel.delete({ where: { id } }),
      );
      return { success: true };
    }),

  /** 清理过期的API调用记录 */
  cleanupExpiredApiCalls: () =>
    Effect.gen(function* () {
      yield* requireAdmin();
      const aiProxyService = yield* AIProxyService;
      const result = yield* aiProxyService.cleanupExpiredApiLogs();
      const ctx = yield* ReqCtxService;
      ctx.log(`${LOG_PREFIX} ${result.message}`);
      return result;
    }),
};
