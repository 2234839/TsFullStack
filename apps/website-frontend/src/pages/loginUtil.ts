import { routeMap, routerUtil } from '@/router';
import { authInfo } from '@/storage';
import type { loginByEmailPwd_res } from '@/utils/apiType';

/**
 * 校验登录回跳地址：只允许站内相对路径（以 / 开头且不以 // 开头），
 * 拒绝外部 URL 与 javascript:/data: 等危险协议（防 open redirect 与 DOM XSS）
 */
export function safeRedirectUrl(r: string | undefined): string | null {
  if (!r) return null;
  const url = decodeURIComponent(r);
  if (!url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) return null;
  return url;
}

/** 登录成功后的跳转逻辑 */
export function loginGoto(
  info?: loginByEmailPwd_res,
  options?: {
    /** 重定向地址 */
    r?: string;
  },
) {
  if (info) {
    authInfo.value = info;
  }

  const redirectUrl = safeRedirectUrl(options?.r);
  if (redirectUrl) {
    location.href = redirectUrl; // 直接跳转到指定的URL
    return; // 阻止后续的跳转逻辑
  }
  routerUtil.push(routeMap.index, {});
}

/** 跳转到登录页面 */
export function gotoLogin(options?: {
  /** 重定向地址 */
  r?: string;
}) {
  routerUtil.push(routeMap.login, { r: options?.r });
}
