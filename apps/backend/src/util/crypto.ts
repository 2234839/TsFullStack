import { hash, compare } from 'bcryptjs';
import { tryOrFail } from './error';

const BCRYPT_SALT_ROUNDS = 10;

/** 密码哈希处理的 Effect 封装 */
export const hashPassword = (password: string) =>
  tryOrFail('密码哈希处理', () => hash(password, BCRYPT_SALT_ROUNDS));

/** 密码比对的 Effect 封装 */
export const comparePassword = (password: string, hashedPassword: string) =>
  tryOrFail('密码比对', () => compare(password, hashedPassword));
