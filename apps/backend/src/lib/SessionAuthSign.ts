import CryptoJS from 'crypto-js';

// 使用 crypto-js 实现 HMAC-SHA256
function cryptoJsHmacSha256(key: string, data: string): string {
  const hmac = CryptoJS.HmacSHA256(data, key);
  return CryptoJS.enc.Hex.stringify(hmac);
}

// 将十六进制字符串转换为 Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// 使用 Uint8Array 进行安全比较（替代 timingSafeEqual）
function timingSafeEqual(a: string, b: string): boolean {
  // 先比较长度
  if (a.length !== b.length) {
    return false;
  }

  // 转换为字节数组
  const aBytes = hexToBytes(a);
  const bBytes = hexToBytes(b);

  // 长度再次确认
  if (aBytes.length !== bBytes.length) {
    return false;
  }

  // 逐字节安全比较
  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i]! ^ bBytes[i]!;
  }
  return result === 0;
}

/** 使用 sessionToken 对原始字符串签名 */
export function signByToken(originStr: string, sessionToken: string): string {
  return cryptoJsHmacSha256(sessionToken, originStr);
}

/** 验证签名是否匹配（使用时间安全比较，防止时序攻击） */
export function verifySignByToken(
  originStr: string,
  sessionToken: string,
  providedSignature: string,
): boolean {
  const expectedSignature = signByToken(originStr, sessionToken);
  return timingSafeEqual(expectedSignature, providedSignature);
}
