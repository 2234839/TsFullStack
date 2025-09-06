import { Effect } from 'effect';
import { ReqCtxService } from '../../Context/ReqCtx';
import { AIConfigContext } from '../../Context/AIConfig';
import { MsgError } from '../../util/error';

export interface InfoQualityRequest {
  content: string;
  model?: string;
}

export interface InfoQualityResponse {
  result: 'pass' | 'block';
  reason?: string;
}

function createOptimizedPrompt(content: string): string {
  return `任务：分类

规则：
- 有价值信息：pass
- 无价值信息：block

要求：
只回答pass或block，禁止其他输出。

内容：${content}

回答：`;
}

async function callOllamaAPI(prompt: string, model: string, ollamaUrl: string): Promise<string> {
  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      /** 禁止思考：https://qwenlm.github.io/blog/qwen3/#advanced-usages */
      prompt: prompt + ' /no_think',
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { response: string; done: boolean };
  return data.response.trim();
}

export function evaluateInfoQuality(request: InfoQualityRequest) {
  return Effect.gen(function* () {
    const ctx = yield* ReqCtxService;
    const aiConfig = yield* AIConfigContext;

    const { content, model = aiConfig.ollama.defaultModel } = request;
    const ollamaUrl = aiConfig.ollama.url;

    if (!content || content.trim().length === 0) {
      throw MsgError.msg('内容不能为空');
    }

    if (content.length > 5000) {
      throw MsgError.msg('内容长度不能超过5000字符');
    }

    try {
      const prompt = createOptimizedPrompt(content);
      const result = yield* Effect.promise(() => callOllamaAPI(prompt, model, ollamaUrl));

      ctx.log('Ollama API 返回结果', { result });

      // 提取最终答案，处理模型可能输出的详细解释
      // 查找最后的明确答案
      const lines = result.split('\n').filter((line) => line.trim());
      const lastLine = lines[lines.length - 1]?.toLowerCase().trim();

      let cleanResult;
      if (lastLine === 'pass') {
        cleanResult = 'pass';
      } else if (lastLine === 'block') {
        cleanResult = 'block';
      } else {
        // 如果最后没有明确答案，搜索整个文本中的最后一个关键词
        const passIndex = result.toLowerCase().lastIndexOf('pass');
        const blockIndex = result.toLowerCase().lastIndexOf('block');

        if (passIndex > blockIndex) {
          cleanResult = 'pass';
        } else {
          cleanResult = 'block';
        }
      }

      if (cleanResult === 'pass') {
        return { result: 'pass' };
      } else {
        return { result: 'block' };
      }
    } catch (error) {
      ctx.log('Ollama API 调用失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw MsgError.msg('信息质量评估服务暂时不可用，请稍后重试');
    }
  });
}
