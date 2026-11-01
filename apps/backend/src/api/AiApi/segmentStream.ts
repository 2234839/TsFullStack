/**
 * AI 智能分段的「模型输出协议」实现（纯函数，前后端共用）。
 *
 * 模型输出是纯文本流，段落边界必须由分隔符表达——标记协议只存在于本模块，
 * 对外暴露的是类型化的 SegmentEvent；应用层（前端/后端调用方）不感知任何标记。
 */

/** 段落元信息（分段理由/复杂度等，模型在段落文本前输出） */
export interface SegmentMeta {
  reason: string;
  complexity: number;
  estimatedReadingTime: number;
  keyVocabulary: string[];
}

/** 流式分段事件（RPC 流式通道的帧类型） */
export type SegmentEvent =
  | { type: 'start'; index: number; meta: SegmentMeta }
  | { type: 'delta'; index: number; textSoFar: string }
  | { type: 'end'; index: number; text: string; meta: SegmentMeta };

/** 模型输出协议标记（仅本模块内部使用） */
const SEG_META_START = '[[META]]';
const SEG_TEXT_START = '[[TEXT]]';
const SEG_END = '[[END]]';

/** 解析段落元信息，带兜底默认值（模型输出不可信，逐字段校验） */
const parseSegmentMeta = (metaText: string): SegmentMeta => {
  try {
    const raw = JSON.parse(metaText) as Partial<SegmentMeta>;
    return {
      reason: typeof raw.reason === 'string' ? raw.reason : 'AI流式分段',
      complexity: Math.min(10, Math.max(1, Math.round(Number(raw.complexity) || 5))),
      estimatedReadingTime: Math.max(1, Math.round(Number(raw.estimatedReadingTime) || 30)),
      keyVocabulary: Array.isArray(raw.keyVocabulary) ? raw.keyVocabulary.filter((w) => typeof w === 'string') : [],
    };
  } catch {
    return { reason: 'AI流式分段', complexity: 5, estimatedReadingTime: 30, keyVocabulary: [] };
  }
};

/**
 * 创建流式分段协议解析器：把模型增量 token 流解析为类型化 SegmentEvent。
 * 协议格式（循环）：[[META]]\n{json}\n[[TEXT]]\n段落原文\n[[END]]
 */
export function createSegmentStreamParser(emit: (event: SegmentEvent) => void) {
  let buffer = '';
  let phase: 'idle' | 'meta' | 'text' = 'idle';
  let meta: SegmentMeta = parseSegmentMeta('');
  let text = '';
  let index = -1;

  const processBuffer = () => {
    for (;;) {
      if (phase === 'idle') {
        const pos = buffer.indexOf(SEG_META_START);
        if (pos === -1) {
          // 保留可能是半个标记的尾部，避免丢帧
          buffer = buffer.slice(-SEG_META_START.length);
          return;
        }
        buffer = buffer.slice(pos + SEG_META_START.length);
        phase = 'meta';
        continue;
      }

      if (phase === 'meta') {
        const pos = buffer.indexOf(SEG_TEXT_START);
        if (pos === -1) {
          // 元信息不应该过长，异常时丢弃防止缓冲无限膨胀
          if (buffer.length > 4096) phase = 'idle';
          return;
        }
        meta = parseSegmentMeta(buffer.slice(0, pos).trim());
        index += 1;
        text = '';
        emit({ type: 'start', index, meta });
        buffer = buffer.slice(pos + SEG_TEXT_START.length);
        phase = 'text';
        continue;
      }

      // phase === 'text'
      const pos = buffer.indexOf(SEG_END);
      if (pos === -1) {
        // 留出可能是半个结束标记的尾部
        const safeLength = buffer.length - SEG_END.length;
        if (safeLength > 0) {
          text += buffer.slice(0, safeLength);
          buffer = buffer.slice(safeLength);
          emit({ type: 'delta', index, textSoFar: text });
        }
        return;
      }
      text += buffer.slice(0, pos);
      buffer = buffer.slice(pos + SEG_END.length);
      const trimmed = text.trim();
      if (trimmed) {
        emit({ type: 'delta', index, textSoFar: trimmed });
        emit({ type: 'end', index, text: trimmed, meta });
      }
      phase = 'idle';
      text = '';
    }
  };

  return {
    /** 喂入一段模型增量文本 */
    push(chunk: string) {
      buffer += chunk;
      processBuffer();
    },
    /** 流结束后收尾：文本阶段残留视为最后一个段落 */
    flush() {
      processBuffer();
      if (phase === 'text') {
        const trimmed = text.trim();
        if (trimmed) emit({ type: 'end', index, text: trimmed, meta });
      }
      phase = 'idle';
    },
  };
}

/** 解析上游 OpenAI SSE 行，返回模型文本增量（非数据帧返回 null） */
export function parseUpstreamSseFrame(frame: string): string | null {
  if (!frame.startsWith('data:')) return null;
  const payload = frame.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  try {
    const chunk = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
    return chunk.choices?.[0]?.delta?.content ?? null;
  } catch {
    // 忽略无法解析的心跳/注释帧
    return null;
  }
}

/**
 * 把超长文章按空行边界切成若干分片：
 * 1. 限制单次请求的输出长度，避免分段结果撞 max_tokens 被截断
 * 2. 逐片处理让首批段落更快上屏
 */
export function splitArticleIntoChunks(text: string, targetChars = 2400): string[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
  const chunks: string[] = [];
  let current = '';

  for (const block of blocks) {
    // 单个块自身超长（无空行的超长文）时，按句号硬切
    if (block.length > targetChars) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      const sentences = block.match(/[^.!?]+[.!?]+/g) ?? [block];
      let sentenceBuf = '';
      for (const sentence of sentences) {
        if (sentenceBuf && sentenceBuf.length + sentence.length > targetChars) {
          chunks.push(sentenceBuf.trim());
          sentenceBuf = sentence;
        } else {
          sentenceBuf += sentence;
        }
      }
      if (sentenceBuf.trim()) chunks.push(sentenceBuf.trim());
      continue;
    }

    if (current && current.length + block.length > targetChars) {
      chunks.push(current);
      current = block;
    } else {
      current = current ? `${current}\n\n${block}` : block;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.length > 0 ? chunks : [text];
}

/** 生成分段 prompt（模型输出协议 instructions，仅后端组装 prompt 时使用） */
export function buildSegmentPrompt(chunkText: string, isFirstChunk: boolean, isLastChunk: boolean): string {
  const boundaryNote = isFirstChunk
    ? '这是文章的开头部分，段落从第一段开始。'
    : isLastChunk
      ? '这是文章的结尾部分，分段到此结束。'
      : '这是文章的中间部分，可能与上下文相连，第一段若是承接上文的残段，请直接从完整句子处开始分段。';

  return `作为英语教学专家，请将以下英文文章片段智能拆分为适合学习的段落，并严格按照给定格式**流式**输出：

${boundaryNote}

原文片段：
"${chunkText}"

拆分要求：
1. 每个段落长度控制在50-150词，确保信息量适中
2. 保持语义完整性，不在句子中间拆分
3. 根据内容逻辑和主题转换进行分段
4. 考虑学习者的阅读耐心，复杂内容适当缩短
5. 段落原文必须一字不差，保留原始换行符
6. reason 用中文书写

输出格式（循环多个段落，除该格式外不要输出任何其他内容）：
[[META]]
{"reason":"拆分理由（中文）","complexity":5,"estimatedReadingTime":60,"keyVocabulary":["word1","word2"]}
[[TEXT]]
段落英文原文
[[END]]`;
}
