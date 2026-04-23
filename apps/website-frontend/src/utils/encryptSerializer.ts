/**
 * 前端 AES-GCM 加密密钥。
 * 注意：前端代码无法真正保密密钥，此加密仅用于防止 localStorage 明文存储，
 * 抵抗非技术用户的好奇浏览，而非抵御有意攻击。生产环境应通过 VITE_SECRET_KEY 环境变量配置。
 */
const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || '__default_frontend_key__';
const encoder = new TextEncoder();
const keyData = encoder.encode(SECRET_KEY);
const keyLength = Math.ceil(keyData.length / 16) * 16;
const paddedKeyData = new Uint8Array(keyLength);
paddedKeyData.set(keyData);

/** AES-GCM IV 长度（12 字节为推荐值） */
const IV_LENGTH = 12;


const key = new Promise<CryptoKey>(async (r) => {
  const k = await crypto.subtle.importKey('raw', paddedKeyData, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  r(k);
});

/** 自定义加密存储序列化器，使用随机 IV 防止相同明文产生相同密文 */
export const encryptSerializer = {
  read: async (raw: string) => {
    try {
      const rawBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
      /** 从密文前缀提取 IV（剩余部分为实际密文） */
      const iv = rawBytes.slice(0, IV_LENGTH);
      const ciphertext = rawBytes.slice(IV_LENGTH);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await key, ciphertext);
      return decrypted ? JSON.parse(new TextDecoder().decode(decrypted)) : undefined;
    } catch {
      /** 密钥变更或数据损坏时静默返回 undefined，让调用方重置为默认值。
       * 同时清除无效数据防止 useStorageAsync 反复写入 */
      localStorage.removeItem('caller-will-set-this-key');
      return undefined;
    }
  },
  write: async (value: unknown) => {
    /** 防止写入 undefined/null 值导致后续 read 解析异常 */
    if (value === undefined || value === null) {
      return '';
    }
    /** 每次加密使用随机 IV，避免固定 IV 导致的密码学弱点 */
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key, new TextEncoder().encode(JSON.stringify(value)));
    /** 将 IV 前置到密文头部，解密时先读取 IV 再解密 */
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    /** 使用循环替代展开运算符，避免大文件时栈溢出（JavaScript 参数上限约 65536） */
    let binary = '';
    for (let i = 0; i < combined.length; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
  },
};
