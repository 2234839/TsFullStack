import { Effect } from 'effect';
import { ReqCtxService } from '../../Context/ReqCtx';
import { AIConfigContext } from '../../Context/AIConfig';
import { MsgError, fail, neverReturn } from '../../util/error';
import { withFetchTimeout, FETCH_TIMEOUTS } from '../../util/http';

/** 信息分辨服务最大内容长度 */
const MAX_CONTENT_LENGTH = 5000;

export interface InfoQualityRequest {
  content: string;
  model?: string;
}

export interface InfoQualityResponse {
  result: 'pass' | 'block';
  reason?: string;
}

/** 最大 prompt 内容长度（含模板前缀） */
const MAX_PROMPT_LENGTH = 5500;

/** 清理用户输入中的潜在 prompt 注入指令 */
function sanitizeForPrompt(content: string): string {
  return content
    .replace(/[\n\r]+/g, ' ') // 将换行替换为空格，破坏多行注入结构
    .slice(0, MAX_CONTENT_LENGTH);
}

function createOptimizedPrompt(content: string): string {
  const sanitized = sanitizeForPrompt(content);
  return `任务：分类

规则：
- 有价值信息：pass
- 无价值信息：block

要求：
只回答pass或block，禁止其他输出。

内容：${sanitized}

回答：`;
}

async function callOllamaAPI(prompt: string, model: string, ollamaUrl: string): Promise<string> {
  const response = await fetch(`${ollamaUrl}/api/generate`, withFetchTimeout({
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
  }, FETCH_TIMEOUTS.ollama));

  if (!response.ok) {
    throw MsgError.msg(`Ollama API request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { response: string; done: boolean };
  return data.response.trim();
}

/** 从 Ollama 返回文本中提取最终的 pass/block 判定 */
function extractVerdict(rawResult: string): 'pass' | 'block' {
  const lines = rawResult.split('\n').filter((line) => line.trim());
  const lastLine = lines[lines.length - 1]?.toLowerCase().trim();

  if (lastLine === 'pass') return 'pass';
  if (lastLine === 'block') return 'block';

  // 搜索整个文本中的最后一个关键词
  const passIndex = rawResult.toLowerCase().lastIndexOf('pass');
  const blockIndex = rawResult.toLowerCase().lastIndexOf('block');
  return passIndex > blockIndex ? 'pass' : 'block';
}

export function evaluateInfoQuality(request: InfoQualityRequest) {
  return Effect.gen(function* () {
    const ctx = yield* ReqCtxService;
    const aiConfig = yield* AIConfigContext;

    const { content, model = aiConfig.ollama.defaultModel } = request;
    const ollamaUrl = aiConfig.ollama.url;

    if (!content || content.trim().length === 0) {
      yield* fail('内容不能为空');
      return neverReturn();
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      yield* fail(`内容长度不能超过${MAX_CONTENT_LENGTH}字符`);
      return neverReturn();
    }

    const prompt = createOptimizedPrompt(content);
    const result = yield* Effect.tryPromise({
      try: () => callOllamaAPI(prompt, model, ollamaUrl),
      catch: (e) => MsgError.msg('Ollama API 调用失败: ' + String(e)),
    });

    ctx.log('[InfoQuality] Ollama 返回: ' + extractVerdict(result));

    return { result: extractVerdict(result) };
  });
}
