// ABOUTME: OAuth 新 tab 登录中继 — 回调页把登录态 postMessage 给同源 opener（浮层登录场景），
// opener 收到后写会话并 ack，回调页 ack 后自动关闭；无 ack 则回退为页内正常跳转
import type { loginByEmailPwd_res } from '@/utils/apiType';

/** 回调页 → opener 的登录态消息类型 */
export const OAUTH_LOGIN_MESSAGE = 'tsfs:oauth-login';
/** opener → 回调页 的确认回执类型 */
export const OAUTH_LOGIN_ACK = 'tsfs:oauth-login-ack';

/**
 * 回调页侧：把登录态 postMessage 给打开本 tab 的同源 opener，等待 opener ack
 * @returns true = opener 已接管登录态（本 tab 可关闭）；false = 无同源 opener 或未收到 ack（回退页内跳转）
 */
export function relayLoginToOpener(info: loginByEmailPwd_res): Promise<boolean> {
  const opener = window.opener;
  if (!opener || opener.closed) return Promise.resolve(false);
  try {
    if (opener.location.origin !== location.origin) return Promise.resolve(false);
  } catch {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const cleanup = () => {
      window.removeEventListener('message', onAck);
      clearTimeout(timer);
    };
    const onAck = (e: MessageEvent) => {
      if (e.origin !== location.origin || (e.data as { type?: string })?.type !== OAUTH_LOGIN_ACK) return;
      cleanup();
      resolve(true);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, 1000);
    window.addEventListener('message', onAck);
    opener.postMessage({ type: OAUTH_LOGIN_MESSAGE, info }, location.origin);
  });
}

/**
 * opener 侧：监听回调 tab 发来的登录态消息（浮层/stayOnSuccess 场景使用）
 * @returns 停止监听函数
 */
export function listenOAuthLoginRelay(onInfo: (info: loginByEmailPwd_res) => void): () => void {
  const onMessage = (e: MessageEvent) => {
    if (e.origin !== location.origin) return;
    const data = e.data as { type?: string; info?: loginByEmailPwd_res };
    if (data?.type !== OAUTH_LOGIN_MESSAGE || !data.info) return;
    onInfo(data.info);
    (e.source as Window | null)?.postMessage({ type: OAUTH_LOGIN_ACK }, location.origin);
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}
