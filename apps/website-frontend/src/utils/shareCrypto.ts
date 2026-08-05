/**
 * 分享端侧加密工具
 *
 * 核心安全模型：
 * - 密码从不发送到服务器，也不存储到后端数据库
 * - 文件二进制内容在上传前用 AES-GCM 加密，后端只存密文
 * - 密码通过 URL hash（#k=...）传递给接收方，hash 不会被浏览器发送到服务器
 * - 即使攻击者拿到数据库或文件 URL，也只能看到密文
 *
 * 密钥派生：用户密码 + 随机盐 → PBKDF2(100000 iterations) → AES-GCM 256-bit key
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** AES-GCM IV 长度（12 字节为 NIST 推荐值） */
const IV_LENGTH = 12;

/** PBKDF2 迭代次数 */
const PBKDF2_ITERATIONS = 100_000;

/** 盐长度（16 字节） */
const SALT_LENGTH = 16;

/** 加密标记：用于验证密码是否正确 */
const MAGIC_STRING = "__share_crypto_valid__";

/**
 * Base64URL 编码（URL 安全，用于 hash 传递）
 */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Base64URL 解码
 */
export function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 从用户密码 + 盐派生 AES-GCM 密钥
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  /** 拷贝到新 ArrayBuffer，确保类型为 ArrayBuffer 而非 SharedArrayBuffer（TS 5.7+ 严格类型） */
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * 生成随机盐
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * 加密字符串，返回 base64 编码的 [IV + 密文]
 */
export async function encryptString(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return base64UrlEncode(combined);
}

/**
 * 解密 base64 编码的 [IV + 密文]
 */
export async function decryptString(encrypted: string, key: CryptoKey): Promise<string> {
  const combined = base64UrlDecode(encrypted);
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return decoder.decode(plaintext);
}

/**
 * 加密二进制数据（ArrayBuffer / Blob），返回密文 ArrayBuffer
 */
export async function encryptBytes(data: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return combined.buffer;
}

/**
 * 解密二进制数据，返回明文 ArrayBuffer
 */
export async function decryptBytes(encrypted: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
  const combined = new Uint8Array(encrypted);
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}

/**
 * 从密码和盐创建完整的加密上下文
 */
export class ShareCrypto {
  private constructor(
    private key: CryptoKey,
    /** 盐（base64Url 编码，用于 URL hash 传递） */
    readonly saltB64: string,
  ) {}

  /**
   * 从用户密码 + 盐创建加密实例
   * @param password 用户输入的密码
   * @param saltB64 base64Url 编码的盐；不传则随机生成（用于创建新分享）
   */
  static async fromPassword(password: string, saltB64?: string): Promise<ShareCrypto> {
    const salt = saltB64 ? base64UrlDecode(saltB64) : generateSalt();
    const key = await deriveKey(password, salt);
    return new ShareCrypto(key, saltB64 ?? base64UrlEncode(salt));
  }

  /** 加密字符串 */
  encryptString(plaintext: string) {
    return encryptString(plaintext, this.key);
  }

  /** 解密字符串 */
  decryptString(encrypted: string) {
    return decryptString(encrypted, this.key);
  }

  /** 加密二进制数据 */
  encryptBytes(data: ArrayBuffer) {
    return encryptBytes(data, this.key);
  }

  /** 解密二进制数据 */
  decryptBytes(encrypted: ArrayBuffer) {
    return decryptBytes(encrypted, this.key);
  }

  /**
   * 生成验证标记（加密后的 magic 字符串）
   * 用于在接收端验证密码是否正确
   */
  async generateVerifier(): Promise<string> {
    return this.encryptString(MAGIC_STRING);
  }

  /**
   * 验证密码是否正确（通过解密 verifier 比对 magic 字符串）
   */
  async verify(verifier: string): Promise<boolean> {
    try {
      const decrypted = await this.decryptString(verifier);
      return decrypted === MAGIC_STRING;
    } catch {
      return false;
    }
  }

  /**
   * 将密码盐打包为 URL hash 参数
   * 格式: k=<salt>&v=<verifier>
   */
  toHashParams(verifier: string): string {
    return `k=${this.saltB64}&v=${verifier}`;
  }
}

/**
 * 从 URL hash 中解析加密参数（盐和验证器）
 * @returns salt 和 verifier，如果不存在则返回 null
 */
export function parseHashParams(hash: string): { salt: string; verifier: string } | null {
  const stripped = hash.replace(/^#/, "");
  const params = new URLSearchParams(stripped);
  const salt = params.get("k");
  const verifier = params.get("v");
  if (!salt || !verifier) return null;
  return { salt, verifier };
}

/**
 * 生成随机密码（用于"默认加密分享"场景）
 * 生成一个足够安全的随机密码，用户无需自己设置
 */
export function generateRandomPassword(length = 16): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  let result = "";
  for (const val of randomValues) {
    result += charset[val % charset.length];
  }
  return result;
}
