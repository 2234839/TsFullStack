import { Effect } from 'effect';
import { AIProxyService } from '../../Context/AIProxyService';
import { AuthContext, authUserIsAdmin } from '../../Context/Auth';
import { PrismaService } from '../../Context/PrismaService';
import { evaluateInfoQuality } from './信息分辨';

/** OpenAI 代理请求接口 */
export interface OpenAIProxyRequest {
  model?: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/** OpenAI 代理响应接口 */
export interface OpenAIProxyResponse {
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

/** AI 模型管理接口 */
export interface AIModel {
  id: number;
  name: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
  enabled: boolean;
  weight: number;
  rpmLimit: number;
  rphLimit: number;
  rpdLimit: number;
  description?: string;
}

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
      const auth = yield* AuthContext;

      // 获取客户端IP和用户ID
      const clientIp = '127.0.0.1'; // TODO: 从Fastify请求中获取真实IP
      const userId = auth.user.id; // 获取当前用户ID

      // 确保model字段有值
      const finalRequest = {
        ...request,
        model: request.model || 'gpt-3.5-turbo', // 默认模型
      };

      // 调用AI代理服务
      const result = yield* aiProxyService.proxyOpenAIRequest(finalRequest, clientIp, userId);
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

      const { prisma } = yield* PrismaService;
      const models = yield* Effect.tryPromise({
        try: () =>
          prisma.aiModel.findMany({
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

      const { prisma } = yield* PrismaService;
      const model = yield* Effect.tryPromise({
        try: () =>
          prisma.aiModel.create({
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

      const { prisma } = yield* PrismaService;
      const model = yield* Effect.tryPromise({
        try: () =>
          prisma.aiModel.update({
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

      const { prisma } = yield* PrismaService;
      yield* Effect.tryPromise({
        try: () =>
          prisma.aiModel.delete({
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
      // 检查管理员权限
      const isAdmin = yield* authUserIsAdmin();
      if (!isAdmin) {
        throw new Error('需要管理员权限');
      }

      const { prisma } = yield* PrismaService;

      // 删除30天前的记录
      const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = yield* Effect.tryPromise({
        try: () =>
          prisma.aiCallLog.deleteMany({
            where: {
              timestamp: {
                lt: cutoffTime,
              },
            },
          }),
        catch: (error) =>
          new Error(`清理过期记录失败: ${error instanceof Error ? error.message : String(error)}`),
      });

      const deleteResult = result as { count: number };
      return {
        success: true,
        deletedCount: deleteResult.count,
        message: `成功清理 ${deleteResult.count} 条过期记录`,
      };
    }),
};
