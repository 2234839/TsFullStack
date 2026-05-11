export type ShareJSON = {
  title: string;
  files: ShareFileJSON[];
};

/** ZenStack Json 字段返回为字符串，解析为 ShareItemJSON */
export function parseShareItem(raw: Record<string, unknown> | null | undefined): ShareItemJSON | undefined {
  if (!raw) return undefined;
  if (typeof raw.data === 'string') {
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
  data: ShareJSON;
  description: string | null;
  version: number;
  userId: string;
  tags: string | null;
  appId: string | null;
};

/** 文本文件 mimetype 列表 */
const textMimetypes = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'application/json',
  'text/javascript',
  'text/typescript',
  'text/x-python',
  'text/css',
  'text/xml',
  'application/xml',
];

/** 判断是否为文本文件 */
export const isTextFile = (mimetype: string) =>
  mimetype.startsWith('text/') || textMimetypes.includes(mimetype);

/** 根据 filename 推断 mimetype */
export const guessMimetype = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    md: 'text/markdown',
    txt: 'text/plain',
    json: 'application/json',
    js: 'text/javascript',
    ts: 'text/typescript',
    py: 'text/x-python',
    css: 'text/css',
    html: 'text/html',
    xml: 'text/xml',
    csv: 'text/csv',
  };
  return map[ext ?? ''] ?? 'text/plain';
};

/** 支持的文件类型 */
const imageTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
];
const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];
const audioTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg', 'audio/aac'];
const documentTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const archiveTypes = [
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
];

const isImageType = (mimetype: string) => imageTypes.includes(mimetype);
const isVideoType = (mimetype: string) => videoTypes.includes(mimetype);
const isAudioType = (mimetype: string) => audioTypes.includes(mimetype);
const isDocumentType = (mimetype: string) => documentTypes.includes(mimetype);
const isArchiveType = (mimetype: string) => archiveTypes.includes(mimetype);

/** 获取文件类型图标 */
export const getFileTypeIcon = (mimetype: string) => {
  if (isImageType(mimetype)) return 'pi pi-image';
  if (isVideoType(mimetype)) return 'pi pi-video';
  if (isAudioType(mimetype)) return 'pi pi-volume-up';
  if (isDocumentType(mimetype)) return 'pi pi-file-pdf';
  if (isArchiveType(mimetype)) return 'pi pi-folder';
  return 'pi pi-file';
};

/** 获取文件类型标签（接受 t 函数参数，避免模块顶层调用 useI18n） */
export const getFileTypeLabel = (type: string, t: (key: string) => string) => {
  if (isImageType(type)) return t('图片');
  if (isVideoType(type)) return t('视频');
  if (isAudioType(type)) return t('音频');
  if (isDocumentType(type)) return t('文档');
  if (isArchiveType(type)) return t('压缩包');
  return t('文件');
};

/** 计算总文件大小 */
export const getTotalFileSize = (share: ShareJSON) => {
  return share.files?.reduce((total, file) => total + (file.size ?? 0), 0) ?? 0;
};

