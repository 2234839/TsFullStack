import { randomBytes } from 'node:crypto';

/** OAuth 随机密码字节数 */
const OAUTH_PASSWORD_BYTES = 32;

/** OAuth 伪邮箱随机字节数（8字节=16hex + "@oauth.local"11字符 = 27字符，不超过 email 字段 @length(6,32) 限制） */
const OAUTH_EMAIL_RANDOM_BYTES = 8;

/** 生成加密安全的随机密码（OAuth 用户不会通过密码登录，仅满足数据库非空约束） */
export function generateSecureRandomPassword(): string {
  return randomBytes(OAUTH_PASSWORD_BYTES).toString('hex');
}

/** 生成伪随机邮箱（OAuth 用户不使用邮箱登录，仅满足数据库唯一约束） */
export function generateFakeEmail(): string {
  return `${randomBytes(OAUTH_EMAIL_RANDOM_BYTES).toString('hex')}@oauth.local`;
}
