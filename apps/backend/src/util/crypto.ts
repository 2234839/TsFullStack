import { hash, compare } from 'bcryptjs';
import { Effect } from 'effect';
import { tryOrFail } from './error';

const BCRYPT_SALT_ROUNDS = 10;

/** 密码哈希处理的 Effect 封装（withSpan 让诊断 Call Tree 自动识别 bcrypt 耗时） */
export const hashPassword = (password: string) =>
  tryOrFail('密码哈希处理', () => hash(password, BCRYPT_SALT_ROUNDS)).pipe(Effect.withSpan('bcrypt.hash'));

/** 密码比对的 Effect 封装（withSpan 让诊断 Call Tree 自动识别 bcrypt 耗时） */
export const comparePassword = (password: string, hashedPassword: string) =>
  tryOrFail('密码比对', () => compare(password, hashedPassword)).pipe(Effect.withSpan('bcrypt.compare'));
