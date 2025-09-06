import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect } from 'effect';
import { evaluateInfoQuality } from './信息分辨';
import { ReqCtxService } from '../../Context/ReqCtx';
import { AIConfigContext } from '../../Context/AIConfig';

// 使用真实的fetch函数，不进行mock

// Mock ReqCtx
const mockReqCtx = {
  user: undefined,
  logs: [] as import('effect/FastCheck').JsonValue[],
  log: vi.fn((...args: import('effect/FastCheck').JsonValue[]) => {
    mockReqCtx.logs.push(args);
    console.log(...args)
  }),
  req: {} as import('fastify').FastifyRequest,
};

// Mock AIConfig
const mockAIConfig = {
  ollama: {
    url: 'http://192.168.1.244:11434',
    defaultModel: 'qwen3:0.6b',
  },
};

describe('evaluateInfoQuality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReqCtx.logs = [];
  });

  it('should evaluate high-quality content', async () => {
    const result = await Effect.runPromise(
      evaluateInfoQuality({
        content:
          'Vue 3 Composition API 完整指南，包含详细的代码示例和最佳实践，深入讲解响应式原理和性能优化技巧。',
      }).pipe(
        Effect.provideService(ReqCtxService, mockReqCtx),
        Effect.provideService(AIConfigContext, mockAIConfig),
      ),
    );

    expect(result).toBeDefined();
    // 验证函数正常工作，返回有效结果
    expect(['pass', 'block']).toContain(result.result);
    console.log('High-quality content evaluation result:', result);
  }, 30000);

  it('should evaluate low-quality content', async () => {
    const result = await Effect.runPromise(
      evaluateInfoQuality({
        content:
          '点击这里免费获得iPhone！！！限时优惠！！！100%真实不是骗局！！！快来快来快来快来！！！',
      }).pipe(
        Effect.provideService(ReqCtxService, mockReqCtx),
        Effect.provideService(AIConfigContext, mockAIConfig),
      ),
    );

    expect(result).toBeDefined();
    // 验证函数正常工作，返回有效结果
    expect(['pass', 'block']).toContain(result.result);
    console.log('Low-quality content evaluation result:', result);
  }, 30000);


  it('should throw error for content exceeding 5000 characters', async () => {
    const longContent = 'a'.repeat(5001);

    await expect(
      Effect.runPromise(
        evaluateInfoQuality({
          content: longContent,
        }).pipe(
          Effect.provideService(ReqCtxService, mockReqCtx),
          Effect.provideService(AIConfigContext, mockAIConfig),
        ),
      ),
    ).rejects.toThrow('内容长度不能超过5000字符');
  });

  it('should handle API errors gracefully', async () => {
    // 使用无效的URL来测试错误处理
    const invalidConfig = {
      ollama: {
        url: 'http://localhost:9999', // 无效的URL
        defaultModel: 'llama3.2',
      },
    };

    await expect(
      Effect.runPromise(
        evaluateInfoQuality({
          content: 'Test content',
        }).pipe(
          Effect.provideService(ReqCtxService, mockReqCtx),
          Effect.provideService(AIConfigContext, invalidConfig),
        ),
      ),
    ).rejects.toThrow();
  });
});
