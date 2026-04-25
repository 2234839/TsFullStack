/**
 * 使用 Web Crypto API 的 HMAC-SHA256 签名（兼容浏览器和 Node.js）
 */
async function hmacSha256(key: string, data: string): Promise<string> {
  const keyData = new TextEncoder().encode(key);
  const dataBytes = new TextEncoder().encode(data);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 使用 sessionToken 对原始字符串签名 */
export async function signByToken(originStr: string, sessionToken: string): Promise<string> {
  return hmacSha256(sessionToken, originStr);
}

/** 将 hex 字符串转为 Uint8Array */
function hexToUint8(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/** 验证签名是否匹配（恒定时间比较，防止时序攻击） */
export async function verifySignByToken(
  originStr: string,
  sessionToken: string,
  providedSignature: string,
): Promise<boolean> {
  const expectedSignature = await signByToken(originStr, sessionToken);
  const expected = hexToUint8(expectedSignature);
  const provided = hexToUint8(providedSignature);

  if (expected.length !== provided.length) return false;

  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected[i]! ^ provided[i]!;
  }
  return result === 0;
}
