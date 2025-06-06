import { routeMap, routerUtil } from '@/router';
import { authInfo } from '@/storage';

/** 登录成功后的跳转逻辑 */
export function loginGoto(
  info: {
    token: string;
    expiresAt: Date;
    userId: string;
  },
  options?: {
    /** 重定向地址 */
    r?: string;
  },
) {
  authInfo.value = {
    userId: info.userId,
    token: info.token,
    expiresAt: info.expiresAt.getTime(),
  };

  if (options?.r) {
    const redirectUrl = decodeURIComponent(options.r);
    location.href = redirectUrl; // 直接跳转到指定的URL
    return; // 阻止后续的跳转逻辑
  }
  routerUtil.push(routeMap.admin, {});
}
