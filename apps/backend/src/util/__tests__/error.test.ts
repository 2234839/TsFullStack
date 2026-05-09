import { describe, it, expect } from 'vitest';
import { MsgError, extractErrorMessage, fail, requireOrFail } from '../error';
import { Effect } from 'effect';

describe('extractErrorMessage', () => {
  it('从 Error 实例中提取 message', () => {
    expect(extractErrorMessage(new Error('test error'))).toBe('test error');
  });

  it('从字符串中返回原值', () => {
    expect(extractErrorMessage('raw string')).toBe('raw string');
  });

  it('从 number 中返回字符串形式', () => {
    expect(extractErrorMessage(42)).toBe('42');
  });

  it('从 null 中返回 "null"', () => {
    expect(extractErrorMessage(null)).toBe('null');
  });

  it('从 undefined 中返回 "undefined"', () => {
    expect(extractErrorMessage(undefined)).toBe('undefined');
  });
});

describe('MsgError', () => {
  it('msg 创建 op_msgError 类型错误', () => {
    const err = MsgError.msg('something failed');
    expect(err).toBeInstanceOf(MsgError);
    expect(err.message).toBe('something failed');
    expect(err.op).toBe(MsgError.op_msgError);
  });

  it('isMsgError 正确识别 MsgError 实例', () => {
    const err = MsgError.msg('test');
    expect(MsgError.isMsgError(err)).toBe(true);
    expect(MsgError.isMsgError(new Error('test'))).toBe(false);
    expect(MsgError.isMsgError(null)).toBe(false);
    expect(MsgError.isMsgError('string')).toBe(false);
  });
});

describe('fail', () => {
  it('返回一个产生 MsgError 的 Effect', async () => {
    const result = await Effect.runPromiseExit(fail('oops'));
    if (result._tag === 'Failure') {
      const error = result.cause._tag === 'Fail' ? result.cause.error : null;
      expect(MsgError.isMsgError(error)).toBe(true);
      expect((error as MsgError).message).toBe('oops');
    } else {
      expect.unreachable('Expected failure');
    }
  });
});

describe('requireOrFail', () => {
  it('有值时返回成功', async () => {
    const result = await Effect.runPromise(Effect.either(requireOrFail('hello', 'missing')));
    expect(result._tag === 'Right' && result.right).toBe('hello');
  });

  it('null 时返回失败', async () => {
    const result = await Effect.runPromise(Effect.either(requireOrFail(null, 'missing')));
    expect(result._tag === 'Left').toBe(true);
  });

  it('undefined 时返回失败', async () => {
    const result = await Effect.runPromise(Effect.either(requireOrFail(undefined, 'missing')));
    expect(result._tag === 'Left').toBe(true);
  });

  it('空字符串时返回成功（空字符串是有效值）', async () => {
    const result = await Effect.runPromise(Effect.either(requireOrFail('', 'missing')));
    expect(result._tag === 'Right').toBe(true);
  });
});
