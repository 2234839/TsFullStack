const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || 'ts i love you';
const encoder = new TextEncoder();
const keyData = encoder.encode(SECRET_KEY);
const keyLength = Math.ceil(keyData.length / 16) * 16;
const paddedKeyData = new Uint8Array(keyLength);
paddedKeyData.set(keyData);


const key = new Promise<CryptoKey>(async (r) => {
  const k = await crypto.subtle.importKey('raw', paddedKeyData, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  r(k);
});

/** 自定义加密存储序列化器  */
export const encryptSerializer = {
  read: async (raw: string) => {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(12) },
      await key,
      Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)),
    );
    return decrypted ? JSON.parse(new TextDecoder().decode(decrypted)) : undefined;
  },
  write: async (value: any) => {
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: new Uint8Array(12) },
      await key,
      new TextEncoder().encode(JSON.stringify(value)),
    );
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  },
};



