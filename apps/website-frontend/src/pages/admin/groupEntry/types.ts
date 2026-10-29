import type { API } from '@/api';

/** 私域空间：公众号引导 + 群码池 */
export type GroupSpace = Awaited<ReturnType<typeof API.groupEntryApi.listSpaces>>[number];
export type SpaceQrCode = GroupSpace['qrcodes'][number];
export type SpaceOfficial = GroupSpace['official'];
export type GroupEntrySettings = Awaited<ReturnType<typeof API.groupEntryApi.getSettings>>;

export const MAX_QR_FILE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_QR_FILE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const GROUP_ENTRY_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const GROUP_FROM_PATTERN = /^[a-zA-Z0-9_-]{0,64}$/;

/**
 * 生成空间的公开链接（/group/<space>），from 为来源参数（项目/渠道标识，可选）
 */
export function publicSpaceUrl(spaceName: string, from?: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  const url = new URL(`/group/${spaceName}`, baseUrl);
  if (from) url.searchParams.set('from', from);
  return url.toString();
}

/** 后台上传的公众号码走后端公开路由，配置文件中的外部 URL 原样使用 */
export function officialAccountQrUrl(qrUrl: string): string {
  if (!qrUrl.startsWith('/')) return qrUrl;
  const baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  return new URL(qrUrl, baseUrl).toString();
}
