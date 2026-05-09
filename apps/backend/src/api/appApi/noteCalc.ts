import { Effect } from 'effect';
import { evaluate as calcEvaluate } from '@tsfullstack/note-calc-engine';
import type { CalcRequest, CalcResponse } from '@tsfullstack/note-calc-engine';

export type { CalcRequest, CalcResponse, LineResult, ResultType } from '@tsfullstack/note-calc-engine';

/**
 * NoteCalc 计算引擎 API
 * 通过 RPC 暴露给前端和其他调用者
 */
export const noteCalcApi = {
  /**
   * 计算表达式内容
   * 接收多行表达式，逐行计算并返回结果
   */
  evaluate(params: CalcRequest): Effect.Effect<CalcResponse, Error> {
    return Effect.try({
      try: () => calcEvaluate(params),
      catch: (error) => error instanceof Error ? error : new Error(String(error)),
    });
  },
};
