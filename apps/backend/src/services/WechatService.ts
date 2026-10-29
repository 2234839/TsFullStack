import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { AppConfig } from '../Context/AppConfig';

/** 日志前缀 */
const LOG_PREFIX = '[Wechat]';

/** access_token 提前刷新余量（微信有效期 7200s） */
const TOKEN_REFRESH_EARLY_MS = 5 * 60 * 1000;

/** 临时素材 media_id 有效期 3 天，缓存 1 天后强制重传 */
const MEDIA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** access_token 内存缓存（单实例部署，无需分布式缓存） */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/** 临时素材 media_id 缓存：key = `${qrId}:${uploadedAt}` */
const mediaCache = new Map<string, { mediaId: string; cachedAt: number }>();

/** 微信回复消息去重缓存：key = `${fromUser}:${msgId}`（微信超时重试 3 次） */
const replyCache = new Map<string, { xml: string; cachedAt: number }>();
const REPLY_CACHE_TTL_MS = 20 * 1000;

/** 微信公众号回调配置 */
type WechatConfig = NonNullable<AppConfig['wechat']>;

/**
 * 校验微信服务器签名：sha1(sort([token, timestamp, nonce])) === signature
 */
export function verifyWechatSignature(
  config: WechatConfig,
  timestamp: string,
  nonce: string,
  signature: string,
): boolean {
  const sha1 = createHash('sha1').update([config.token, timestamp, nonce].sort().join('')).digest('hex');
  return sha1 === signature;
}

/**
 * 解析微信消息 XML：微信的 XML 是扁平结构，直接按字段提取 CDATA 或纯文本值
 */
export function parseWechatMessage(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /<([A-Za-z]+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[1]) result[m[1]] = (m[2] ?? m[3] ?? '').trim();
  }
  return result;
}

/** XML 文本转义 */
function escapeXmlText(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

/** 构造被动回复的文本消息 XML */
export function buildTextReplyXml(toUser: string, fromUser: string, content: string): string {
  return (
    `<xml><ToUserName><![CDATA[${toUser}]]></ToUserName>` +
    `<FromUserName><![CDATA[${fromUser}]]></FromUserName>` +
    `<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>` +
    `<MsgType><![CDATA[text]]></MsgType>` +
    `<Content><![CDATA[${escapeXmlText(content)}]]></Content></xml>`
  );
}

/** 构造被动回复的图片消息 XML */
export function buildImageReplyXml(toUser: string, fromUser: string, mediaId: string): string {
  return (
    `<xml><ToUserName><![CDATA[${toUser}]]></ToUserName>` +
    `<FromUserName><![CDATA[${fromUser}]]></FromUserName>` +
    `<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>` +
    `<MsgType><![CDATA[image]]></MsgType>` +
    `<Image><MediaId><![CDATA[${mediaId}]]></MediaId></Image></xml>`
  );
}

/** 微信 API 错误 */
export class WechatApiError extends Error {
  constructor(
    message: string,
    /** 微信错误码（errcode） */
    public readonly code: number,
  ) {
    super(message);
    this.name = 'WechatApiError';
  }
}

/**
 * 获取（并缓存）access_token；到期前 5 分钟自动刷新，失败时清除缓存抛错
 */
export async function getAccessToken(config: WechatConfig): Promise<string> {
  const cached = tokenCache.get(config.appId);
  if (cached && cached.expiresAt > Date.now() + TOKEN_REFRESH_EARLY_MS) return cached.token;
  const url =
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential` +
    `&appid=${encodeURIComponent(config.appId)}&secret=${encodeURIComponent(config.appSecret)}`;
  const res = await fetch(url);
  const data = (await res.json()) as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string };
  if (!data.access_token) {
    throw new WechatApiError(`获取 access_token 失败: ${data.errcode} ${data.errmsg ?? ''}`, data.errcode ?? -1);
  }
  tokenCache.set(config.appId, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
  });
  return data.access_token;
}

/**
 * 上传本地图片为微信临时素材（type=image），返回 media_id；同图 24h 内复用缓存。
 * 临时素材 media_id 有效期 3 天，足够覆盖群码 7 天轮换周期内的重复请求
 */
export async function uploadTempImage(
  config: WechatConfig,
  cacheKey: string,
  absPath: string,
  mime: string,
): Promise<string> {
  const cached = mediaCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < MEDIA_CACHE_TTL_MS) return cached.mediaId;

  const token = await getAccessToken(config);
  const buffer = await readFile(absPath);
  const form = new FormData();
  form.append(
    'media',
    new Blob([new Uint8Array(buffer)], { type: mime }),
    `qr.${mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'}`,
  );
  const res = await fetch(`https://api.weixin.qq.com/cgi-bin/media/upload?access_token=${token}&type=image`, {
    method: 'POST',
    body: form,
  });
  const data = (await res.json()) as { media_id?: string; errcode?: number; errmsg?: string };
  if (!data.media_id) {
    // access_token 失效（40001/42001）时清缓存让下次重取
    if (data.errcode === 40001 || data.errcode === 42001) tokenCache.delete(config.appId);
    throw new WechatApiError(`上传临时素材失败: ${data.errcode} ${data.errmsg ?? ''}`, data.errcode ?? -1);
  }
  mediaCache.set(cacheKey, { mediaId: data.media_id, cachedAt: Date.now() });
  return data.media_id;
}

/**
 * 取（或重建）某条用户消息的回复：微信 5 秒超时会重试 3 次，相同 msgId 直接复用上次结果
 */
export async function cachedReply(key: string, build: () => string | Promise<string>): Promise<string> {
  const cached = replyCache.get(key);
  if (cached && Date.now() - cached.cachedAt < REPLY_CACHE_TTL_MS) return cached.xml;
  const xml = await build();
  replyCache.set(key, { xml, cachedAt: Date.now() });
  if (replyCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of replyCache) {
      if (now - v.cachedAt > REPLY_CACHE_TTL_MS) replyCache.delete(k);
    }
  }
  return xml;
}

export function wechatLog(...args: unknown[]): void {
  console.log(LOG_PREFIX, ...args);
}
