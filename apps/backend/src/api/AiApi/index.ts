import { Effect } from 'effect';
import { AIProxyService } from '../../Context/AIProxyService';
import { authUserIsAdmin } from '../../Context/Auth';
import { reqClientIpEffect } from '../../Context/ClientIPService';
import { DbService } from '../../Context/DbService';
import { ReqCtxService } from '../../Context/ReqCtx';
import {
  AIModel,
  OpenAIRequest as OpenAIProxyRequest,
  OpenAIResponse as OpenAIProxyResponse,
} from '../../types/ai';
import { evaluateInfoQuality } from './信息分辨';

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
      // 获取客户端IP
      const clientIp = yield* reqClientIpEffect;

      // 确保model字段有值
      const finalRequest = {
        ...request,
        model: request.model || 'gpt-3.5-turbo', // 默认模型
      };

      // 调用AI代理服务
      const result = yield* aiProxyService.proxyOpenAIRequest(finalRequest, clientIp);
      return result as OpenAIProxyResponse;
    }),

  /** 获取所有AI模型（管理员） */
  getAIModels: () =>
    Effect.gen(function* () {
      // 检查管理员权限
      const isAdmin = yield* authUserIsAdmin();
      if (!isAdmin) {
        throw new Error('需要管理员权限');
      }

      const { dbClient } = yield* DbService;
      const models = yield* Effect.tryPromise({
        try: () =>
          dbClient.aiModel.findMany({
            orderBy: { id: 'asc' },
          }),
        catch: (error) =>
          new Error(`获取AI模型失败: ${error instanceof Error ? error.message : String(error)}`),
      });

      return models as AIModel[];
    }),

  /** 创建AI模型（管理员） */
  createAIModel: (request: CreateAIModelRequest) =>
    Effect.gen(function* () {
      // 检查管理员权限
      const isAdmin = yield* authUserIsAdmin();
      if (!isAdmin) {
        throw new Error('需要管理员权限');
      }

      const { dbClient } = yield* DbService;
      const model = yield* Effect.tryPromise({
        try: () =>
          dbClient.aiModel.create({
            data: {
              name: request.name,
              model: request.model,
              baseUrl: request.baseUrl,
              apiKey: request.apiKey,
              maxTokens: request.maxTokens || 2000,
              temperature: request.temperature || 0.7,
              enabled: request.enabled !== undefined ? request.enabled : true,
              weight: request.weight || 100,
              rpmLimit: request.rpmLimit || 60,
              rphLimit: request.rphLimit || 1000,
              rpdLimit: request.rpdLimit || 10000,
              description: request.description,
            },
          }),
        catch: (error) =>
          new Error(`创建AI模型失败: ${error instanceof Error ? error.message : String(error)}`),
      });

      return model as AIModel;
    }),

  /** 更新AI模型（管理员） */
  updateAIModel: (request: UpdateAIModelRequest) =>
    Effect.gen(function* () {
      // 检查管理员权限
      const isAdmin = yield* authUserIsAdmin();
      if (!isAdmin) {
        throw new Error('需要管理员权限');
      }

      const { dbClient } = yield* DbService;
      const model = yield* Effect.tryPromise({
        try: () =>
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
        catch: (error) =>
          new Error(`更新AI模型失败: ${error instanceof Error ? error.message : String(error)}`),
      });

      return model as AIModel;
    }),

  /** 删除AI模型（管理员） */
  deleteAIModel: (id: number) =>
    Effect.gen(function* () {
      // 检查管理员权限
      const isAdmin = yield* authUserIsAdmin();
      if (!isAdmin) {
        throw new Error('需要管理员权限');
      }

      const { dbClient } = yield* DbService;
      yield* Effect.tryPromise({
        try: () =>
          dbClient.aiModel.delete({
            where: { id },
          }),
        catch: (error) =>
          new Error(`删除AI模型失败: ${error instanceof Error ? error.message : String(error)}`),
      });

      return { success: true };
    }),

  /** 清理过期的API调用记录 */
  cleanupExpiredApiCalls: () =>
    Effect.gen(function* () {
      if (!(yield* authUserIsAdmin())) {
        throw new Error('需要管理员权限');
      }

      const aiProxyService = yield* AIProxyService;
      const result = yield* aiProxyService.cleanupExpiredApiLogs();

      const ctx = yield* ReqCtxService;
      ctx.log(result.message);
      return result;
    }),
};
