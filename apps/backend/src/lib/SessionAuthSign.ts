/** 复用无状态的 TextEncoder 实例 */
const textEncoder = new TextEncoder();

/**
 * 使用 Web Crypto API 的 HMAC-SHA256 签名（兼容浏览器和 Node.js）
 * cryptoKey 按缓存 key 复用，避免重复 importKey 开销
 */
const cryptoKeyCache = new Map<string, CryptoKey>();

async function hmacSha256(key: string, data: string): Promise<string> {
  let cryptoKey = cryptoKeyCache.get(key);
  if (!cryptoKey) {
    cryptoKey = await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(key),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    cryptoKeyCache.set(key, cryptoKey);
  }

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, textEncoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 使用 sessionToken 对原始字符串签名 */
export async function signByToken(originStr: string, sessionToken: string): Promise<string> {
  return hmacSha256(sessionToken, originStr);
}

/** 将 hex 字符串转为 Uint8Array（非法 hex 返回 null，避免 NaN 字节导致的未定义行为） */
function hexToUint8(hex: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    return null;
  }
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
  /** 非法格式（非 hex 或长度不符）直接拒绝，且不提前返回造成时序差异泄露长度信息 */
  if (!expected || !provided) return false;

  if (expected.length !== provided.length) return false;

  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected[i]! ^ provided[i]!;
  }
  return result === 0;
}
