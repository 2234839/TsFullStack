export type ShareJSON = {
  title: string;
  files: ShareFileJSON[];
};

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

// 支持的文件类型
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

// // 获取文件预览
// const getFilePreview = async (file: ShareFileJSON) => {
//   if (!file) return '';
//   if (isImageType(file?.mimetype)) {
//     return await APIGetUrl.fileApi.file(file.id);
//   }
//   return '';
// };

// 获取文件预览样式类
export const getFilePreviewClass = (file: ShareFileJSON) => {
  if (!file) return '';
  if (isImageType(file.mimetype)) {
    return 'bg-white dark:bg-gray-600';
  }
  if (isVideoType(file.mimetype)) {
    return 'bg-purple-100 dark:bg-purple-900';
  }
  if (isAudioType(file.mimetype)) {
    return 'bg-pink-100 dark:bg-pink-900';
  }
  if (isDocumentType(file.mimetype)) {
    return 'bg-blue-100 dark:bg-blue-900';
  }
  if (isArchiveType(file.mimetype)) {
    return 'bg-yellow-100 dark:bg-yellow-900';
  }
  return 'bg-gray-200 dark:bg-gray-600';
};

// 获取文件类型图标
export const getFileTypeIcon = (mimetype: string) => {
  if (isImageType(mimetype)) return 'pi pi-image';
  if (isVideoType(mimetype)) return 'pi pi-video';
  if (isAudioType(mimetype)) return 'pi pi-volume-up';
  if (isDocumentType(mimetype)) return 'pi pi-file-pdf';
  if (isArchiveType(mimetype)) return 'pi pi-folder';
  return 'pi pi-file';
};

// 获取文件类型标签
export const getFileTypeLabel = (type: string) => {
  if (isImageType(type)) return '图片';
  if (isVideoType(type)) return '视频';
  if (isAudioType(type)) return '音频';
  if (isDocumentType(type)) return '文档';
  if (isArchiveType(type)) return '压缩包';
  return '文件';
};

// 获取文件类型列表
export const getFileTypes = (share: ShareJSON) => {
  const types = new Set<string>();
  share.files.forEach((file) => {
    if (isImageType(file.mimetype)) types.add('图片');
    else if (isVideoType(file.mimetype)) types.add('视频');
    else if (isAudioType(file.mimetype)) types.add('音频');
    else if (isDocumentType(file.mimetype)) types.add('文档');
    else if (isArchiveType(file.mimetype)) types.add('压缩包');
    else types.add('其他');
  });
  return Array.from(types);
};

// 计算总文件大小
export const getTotalFileSize = (share: ShareJSON) => {
  return share.files.reduce((total, file) => total + (file.size || 0), 0);
};

// 格式化文件大小
export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
