/**
 * 分享元数据：标题 + 文件列表
 * 加密分享时，整个 ShareJSON 被加密为密文存入 payload
 */
export type ShareJSON = {
  title: string;
  files: ShareFileJSON[];
};

/**
 * UserData.data 字段的结构
 *
 * - 未加密：直接是 ShareJSON（明文，兼容旧数据）
 * - 加密：{ encrypted: true, payload, salt } 其中 payload 是加密后的 ShareJSON
 *
 * 密码只在 URL hash 中（#p=密码&k=盐），后端不存储密码。
 * salt 明文存储在数据中（salt 不保密，只防彩虹表），
 * 这样即使用户没有 hash 链接、手动输入密码也能解密。
 */
export type ShareData =
  | ShareJSON
  | {
      /** 标记为加密分享 */
      encrypted: true;
      /** 加密后的 ShareJSON（title + files 全部加密在里面） */
      payload: string;
      /** PBKDF2 盐（base64，明文存储，用于密钥派生） */
      salt: string;
    };

/**
 * 判断 ShareData 是否为加密格式
 */
export function isEncryptedData(data: unknown): data is {
  encrypted: true;
  payload: string;
  salt: string;
} {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { encrypted?: unknown }).encrypted === true
  );
}

/** ZenStack Json 字段返回为字符串，解析为 ShareItemJSON */
export function parseShareItem(
  raw: Record<string, unknown> | null | undefined,
): ShareItemJSON | undefined {
  if (!raw) return undefined;
  if (typeof raw.data === "string") {
    raw.data = JSON.parse(raw.data);
  }
  return raw as unknown as ShareItemJSON;
}

export type ShareFileJSON = {
  path: string;
  id: number;
  created: string; // ISO 格式的日期字符串
  updated: string; // ISO 格式的日期字符串
  authorId: string;
  filename: string;
  mimetype: string;
  size: number;
};
export type ShareItemJSON = {
  id: number;
  created: string; // ISO 格式的日期字符串
  updated: string; // ISO 格式的日期字符串
  key: string;
  data: ShareData;
  description: string | null;
  version: number;
  userId: string;
  tags: string | null;
  appId: string | null;
};

/** 文本文件 mimetype 列表 */
const textMimetypes = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  "text/javascript",
  "text/typescript",
  "text/x-python",
  "text/css",
  "text/xml",
  "application/xml",
];

/** 判断是否为文本文件 */
export const isTextFile = (mimetype: string) =>
  mimetype.startsWith("text/") || textMimetypes.includes(mimetype);

/** 根据 filename 推断 mimetype */
export const guessMimetype = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    md: "text/markdown",
    txt: "text/plain",
    json: "application/json",
    js: "text/javascript",
    ts: "text/typescript",
    py: "text/x-python",
    css: "text/css",
    html: "text/html",
    xml: "text/xml",
    csv: "text/csv",
  };
  return map[ext ?? ""] ?? "text/plain";
};

/** 支持的文件类型 */
const imageTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
];
const videoTypes = ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo"];
const audioTypes = ["audio/mp3", "audio/wav", "audio/ogg", "audio/mpeg", "audio/aac"];
const documentTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const archiveTypes = [
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
];

const isImageType = (mimetype: string) => imageTypes.includes(mimetype);
const isVideoType = (mimetype: string) => videoTypes.includes(mimetype);
const isAudioType = (mimetype: string) => audioTypes.includes(mimetype);
const isDocumentType = (mimetype: string) => documentTypes.includes(mimetype);
const isArchiveType = (mimetype: string) => archiveTypes.includes(mimetype);

/** 获取文件类型图标 */
export const getFileTypeIcon = (mimetype: string) => {
  if (isImageType(mimetype)) return "pi pi-image";
  if (isVideoType(mimetype)) return "pi pi-video";
  if (isAudioType(mimetype)) return "pi pi-volume-up";
  if (isDocumentType(mimetype)) return "pi pi-file-pdf";
  if (isArchiveType(mimetype)) return "pi pi-folder";
  return "pi pi-file";
};

/** 获取文件类型标签（接受 t 函数参数，避免模块顶层调用 useI18n） */
export const getFileTypeLabel = (type: string, t: (key: string) => string) => {
  if (isImageType(type)) return t("图片");
  if (isVideoType(type)) return t("视频");
  if (isAudioType(type)) return t("音频");
  if (isDocumentType(type)) return t("文档");
  if (isArchiveType(type)) return t("压缩包");
  return t("文件");
};

/** 计算总文件大小 */
export const getTotalFileSize = (share: ShareJSON) => {
  return share.files?.reduce((total, file) => total + (file.size ?? 0), 0) ?? 0;
};

// ──────────────── 加密/解密辅助函数 ────────────────

import { ShareCrypto, base64UrlEncode, base64UrlDecode } from "@/utils/shareCrypto";

/**
 * 将 ShareJSON 加密为可存储的 ShareData，并生成 URL hash 参数
 *
 * @param share 明文分享数据
 * @param password 用户密码
 * @returns { data: 加密后的 ShareData, hashParams: URL hash 参数 }
 *          hashParams 格式: k=<盐>&p=<密码>（放在 URL # 后面，不发送到服务器）
 */
export async function encryptShareData(
  share: ShareJSON,
  password: string,
): Promise<{
  data: Extract<ShareData, { encrypted: true }>;
  hashParams: string;
}> {
  const crypto = await ShareCrypto.fromPassword(password);
  const payload = await crypto.encryptString(JSON.stringify(share));
  return {
    data: { encrypted: true, payload, salt: crypto.saltB64 },
    hashParams: `k=${crypto.saltB64}&p=${base64UrlEncode(new TextEncoder().encode(password))}`,
  };
}

/**
 * 用密码解密 ShareData，返回明文 ShareJSON
 * 密码错误时解密会失败（AES-GCM 认证不通过），返回 null
 *
 * salt 来源优先级：参数传入 > 数据中存储的 salt
 * （URL hash 中的 salt 和数据中存储的 salt 是同一个）
 */
export async function decryptShareData(
  data: ShareData,
  password: string,
  salt?: string,
): Promise<ShareJSON | null> {
  if (!isEncryptedData(data)) {
    /** 未加密，直接返回 */
    return data as ShareJSON;
  }
  /** salt 优先用传入的（来自 URL hash），否则用数据中存储的 */
  const actualSalt = salt ?? data.salt;
  const crypto = await ShareCrypto.fromPassword(password, actualSalt);
  try {
    const json = await crypto.decryptString(data.payload);
    return JSON.parse(json) as ShareJSON;
  } catch {
    /** 密码错误，解密失败 */
    return null;
  }
}

/**
 * 从 URL hash 参数中解析密码和盐
 * @returns { password, salt } 或 null
 */
export function parseShareHashParams(hash: string): { password: string; salt: string } | null {
  const stripped = hash.replace(/^#/, "");
  const params = new URLSearchParams(stripped);
  const salt = params.get("k");
  const passwordEncoded = params.get("p");
  if (!salt || !passwordEncoded) return null;
  const password = new TextDecoder().decode(base64UrlDecode(passwordEncoded));
  return { password, salt };
}

/**
 * 从 ShareItemJSON 中提取明文 ShareJSON
 * - 未加密的分享直接返回
 * - 加密的分享返回 null（需要密码才能解密）
 */
export function getPlaintextShare(item: { data: ShareData }): ShareJSON | null {
  if (isEncryptedData(item.data)) return null;
  return item.data as ShareJSON;
}
