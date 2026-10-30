import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Cache, Duration, Effect } from 'effect';
import type { AppConfig } from '../Context/AppConfig';
import { withFetchTimeout, FETCH_TIMEOUTS } from '../util/http';
import { fetchJsonOrThrow } from '../util/fetchJson';
import { extractErrorMessage } from '../util/error';

/** 日志前缀 */
const LOG_PREFIX = '[Wechat]';

/** access_token 提前刷新余量（微信有效期 7200s） */
const TOKEN_REFRESH_EARLY_MS = 5 * 60 * 1000;

/** 临时素材 media_id 有效期 3 天，缓存 1 天后强制重传 */
const MEDIA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** 微信回复消息去重缓存 TTL（微信超时重试 3 次窗口） */
const REPLY_CACHE_TTL_MS = 20 * 1000;

/** access_token 提前刷新余量（微信有效期 7200s，提前 5 分钟过期） */
const TOKEN_CACHE_TTL = Duration.minutes(115);

/** access_token 缓存：Effect Cache 并发单飞，避免 token 过期瞬间并发重取（key = appId） */
const tokenCache = Effect.runSync(
  Cache.make<string, string, WechatApiError, never, never>({
    capacity: 16,
    timeToLive: TOKEN_CACHE_TTL,
    lookup: (appId) => fetchAccessToken(appId),
  }),
);

/** access_token 实际获取：网络/HTTP/JSON 错误拆分，业务失败抛 WechatApiError */
function fetchAccessToken(appId: string): Effect.Effect<string, WechatApiError> {
  return Effect.gen(function* () {
    const config = appConfigByAppId.get(appId);
    if (!config) throw new WechatApiError(`未注册的 appId: ${appId}`, -1);
    const url =
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential` +
      `&appid=${encodeURIComponent(config.appId)}&secret=${encodeURIComponent(config.appSecret)}`;
    const data = (yield* Effect.tryPromise({
      try: () => fetchJsonOrThrow('微信 token 接口', url, withFetchTimeout({}, FETCH_TIMEOUTS.payment)),
      catch: (error: unknown) => new WechatApiError(`获取 access_token 失败: ${extractErrorMessage(error)}`, -1),
    })) as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string };
    if (!data.access_token) {
      throw new WechatApiError(`获取 access_token 失败: ${data.errcode} ${data.errmsg ?? ''}`, data.errcode ?? -1);
    }
    return data.access_token;
  });
}

/** appId → 配置 的注册表，供 Cache lookup 反查（Cache key 只能是字符串） */
const appConfigByAppId = new Map<string, WechatConfig>();

/** 临时素材 media_id 缓存：key = `${qrId}:${uploadedAt}`（24h 后强制重传） */
const mediaCache = Effect.runSync(
  Cache.make<string, string, WechatApiError, never, never>({
    capacity: 200,
    timeToLive: Duration.millis(MEDIA_CACHE_TTL_MS),
    lookup: (cacheKey) => {
      const entry = mediaCacheKeys.get(cacheKey);
      if (!entry) return Effect.fail(new WechatApiError(`未注册的素材缓存 key: ${cacheKey}`, -1));
      return uploadTempImageUncached(entry);
    },
  }),
);

/** cacheKey → 上传所需参数 的伴生注册表（Cache lookup 无额外入参，通过伴生 Map 传递） */
const mediaCacheKeys = new Map<string, { appId: string; absPath: string; mime: string }>();

/** 微信回复消息去重缓存：key = `${fromUser}:${msgId}`（微信 5s 超时重试 3 次窗口内复用同一回复） */
const replyCache = Effect.runSync(
  Cache.make<string, string, never, never, never>({
    capacity: 1000,
    timeToLive: Duration.millis(REPLY_CACHE_TTL_MS),
    lookup: (key) => {
      const build = replyCacheBuilders.get(key);
      if (!build) return Effect.succeed('');
      return Effect.promise(() => Promise.resolve(build()));
    },
  }),
);
/** cacheKey → 回复构造器 的伴生注册表（Cache lookup 无额外入参） */
const replyCacheBuilders = new Map<string, () => string | Promise<string>>();

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
 * 获取（并缓存）access_token；Cache 并发单飞，到期前自动刷新（TTL 已扣除 5 分钟余量）
 */
export function getAccessToken(config: WechatConfig): Promise<string> {
  /** lookup 只拿 key，配置通过伴生注册表传递（同 appId 重复注册幂等） */
  appConfigByAppId.set(config.appId, config);
  return Effect.runPromise(Cache.get(tokenCache, config.appId));
}

/** access_token 实际获取：网络/HTTP/JSON 错误拆分，业务失败抛 WechatApiError */

/**
 * 上传本地图片为微信临时素材（type=image），返回 media_id；Cache 并发单飞 + 24h TTL。
 * 临时素材 media_id 有效期 3 天，足够覆盖群码 7 天轮换周期内的重复请求
 */
export function uploadTempImage(
  config: WechatConfig,
  cacheKey: string,
  absPath: string,
  mime: string,
): Promise<string> {
  /** lookup 只拿 key，上传参数通过伴生注册表传递 */
  appConfigByAppId.set(config.appId, config);
  mediaCacheKeys.set(cacheKey, { appId: config.appId, absPath, mime });
  return Effect.runPromise(Cache.get(mediaCache, cacheKey));
}

/** 实际上传：无缓存直连微信接口 */
function uploadTempImageUncached(entry: {
  appId: string;
  absPath: string;
  mime: string;
}): Effect.Effect<string, WechatApiError> {
  return Effect.gen(function* () {
    const token = yield* Cache.get(tokenCache, entry.appId);
    const buffer = yield* Effect.tryPromise({
      try: () => readFile(entry.absPath),
      catch: (error: unknown) => new WechatApiError(`读取群码图片失败: ${extractErrorMessage(error)}`, -1),
    });
    const form = new FormData();
    form.append(
      'media',
      new Blob([new Uint8Array(buffer)], { type: entry.mime }),
      `qr.${entry.mime === 'image/png' ? 'png' : entry.mime === 'image/webp' ? 'webp' : 'jpg'}`,
    );
    const data = (yield* Effect.tryPromise({
      try: () =>
        fetchJsonOrThrow(
          '微信素材上传',
          `https://api.weixin.qq.com/cgi-bin/media/upload?access_token=${token}&type=image`,
          withFetchTimeout({ method: 'POST', body: form }, FETCH_TIMEOUTS.payment),
        ),
      catch: (error: unknown) => new WechatApiError(`上传临时素材失败: ${extractErrorMessage(error)}`, -1),
    })) as { media_id?: string; errcode?: number; errmsg?: string };
    if (!data.media_id) {
      // access_token 失效（40001/42001）时清缓存让下次重取
      if (data.errcode === 40001 || data.errcode === 42001) yield* Cache.invalidate(tokenCache, entry.appId);
      throw new WechatApiError(`上传临时素材失败: ${data.errcode} ${data.errmsg ?? ''}`, data.errcode ?? -1);
    }
    return data.media_id;
  });
}

/**
 * 取（或重建）某条用户消息的回复：微信 5 秒超时会重试 3 次，相同 msgId 直接复用上次结果。
 * Cache 并发单飞保证重试不会触发多次 build
 */
export function cachedReply(key: string, build: () => string | Promise<string>): Promise<string> {
  replyCacheBuilders.set(key, build);
  return Effect.runPromise(Cache.get(replyCache, key));
}

export function wechatLog(...args: unknown[]): void {
  console.log(LOG_PREFIX, ...args);
}
