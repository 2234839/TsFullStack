/**
 * 图片 MIME 白名单与格式转换的统一出口：
 * 后端上传校验（群码/公众号码）、SVG 内嵌位图防护、任务图片落盘命名共用这里，
 * 新增图片入口时禁止在调用点再手写白名单数组。
 */

/** 允许上传/内嵌的位图 MIME 类型（png/jpeg/webp） */
export const ALLOWED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** MIME 是否在允许的位图白名单内 */
export const isValidImageMime = (mime: string): boolean => (ALLOWED_IMAGE_MIMES as readonly string[]).includes(mime);

/**
 * 扩展名（不含点）转图片 MIME：jpg→image/jpeg，其余按原名映射
 * 未知扩展名原样返回 `image/<ext>`，调用方需自行保证白名单
 */
export const imageMimeFromExt = (ext: string): string => `image/${ext === 'jpg' ? 'jpeg' : ext}`;

/** MIME 转存储用扩展名（不含点）：jpeg 归一为 jpg */
export const imageExtFromMime = (mime: string): string =>
  mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
