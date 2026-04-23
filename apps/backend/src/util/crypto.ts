import { Effect } from 'effect';
import { hash, compare } from 'bcryptjs';
import { MsgError } from './error';

const BCRYPT_SALT_ROUNDS = 10;

/** 密码哈希处理的 Effect 封装 */
export const hashPassword = (password: string) =>
  Effect.tryPromise({
    try: () => hash(password, BCRYPT_SALT_ROUNDS),
    catch: () => MsgError.msg('密码哈希处理失败'),
  });

/** 密码比对的 Effect 封装 */
export const comparePassword = (password: string, hashedPassword: string) =>
  Effect.tryPromise({
    try: () => compare(password, hashedPassword),
    catch: () => MsgError.msg('密码比对失败'),
  });
