import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Effect } from 'effect';
import { AppConfigService, type AppConfig } from '../Context/AppConfig';
import { KVStore, localKVStore } from '../Context/KVStore';
import { GroupEntryService } from '../services/GroupEntryService';
import { PasscodeService } from '../services/PasscodeService';
import { extractErrorMessage } from '../util/error';
import {
  buildImageReplyXml,
  buildTextReplyXml,
  cachedReply,
  downloadMediaImage,
  parseWechatMessage,
  uploadTempImage,
  verifyWechatSignature,
  wechatLog,
} from '../services/WechatService';
import { archiveMessage, handleImageMessage, handleTextCommand } from '../services/WechatCommandService';

/** 日志前缀 */
const LOG_PREFIX = '[Wechat]';

/** 统一的 Effect 运行辅助：为 Service 层程序注入 AppConfigService，失败时返回 fallback */
async function runEffect<T>(
  program: Effect.Effect<T, Error, AppConfigService | KVStore>,
  appConfig: AppConfig,
  fallback: T,
): Promise<T> {
  try {
    return await Effect.runPromise(
      Effect.provideService(Effect.provideService(program, AppConfigService, appConfig), KVStore, localKVStore),
    );
  } catch (e) {
    console.error(`${LOG_PREFIX} 处理失败:`, extractErrorMessage(e));
    return fallback;
  }
}

/** 从请求头推导对外 base URL（用于文本回复里的落地页链接） */
function baseUrlOf(req: FastifyRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = (req.headers.host as string) || '';
  return `${proto}://${host}`;
}

/**
 * 处理文本消息并生成回复 XML：
 * - 关键词命中空间 → 优先回图片（当前有效群码），无有效码/上传失败回引导文本
 * - 其他消息 → 回引导文本（提示回复关键词）
 */
async function handleTextMessage(
  appConfig: AppConfig,
  toUser: string,
  fromUser: string,
  content: string,
  baseUrl: string,
): Promise<string> {
  const { groupEntry: geConfig, wechat } = appConfig;
  const result = await runEffect(GroupEntryService.getActiveQrByReplyKeyword(content), appConfig, null);
  if (!result) {
    const keyword = geConfig?.replyKeyword || '加群';
    return buildTextReplyXml(toUser, fromUser, `欢迎关注～回复「${keyword}」获取最新入群二维码`);
  }
  // 命中空间：尝试图片回复
  if (result.qr && wechat) {
    try {
      const mediaId = await uploadTempImage(
        wechat,
        `${result.qr.id}:${result.qr.uploadedAt.getTime()}`,
        result.qr.absPath,
        result.qr.imageMime,
      );
      return buildImageReplyXml(toUser, fromUser, mediaId);
    } catch (e) {
      wechatLog('群码上传临时素材失败，回退文本引导:', extractErrorMessage(e));
    }
  }
  // 文本引导：优先空间引导语，否则默认文案 + 落地页链接
  const link = `${baseUrl}/group/${result.spaceName}?from=wechat`;
  const text = result.official.guideText || `最新入群二维码请戳：${link}\n（或回到公众号菜单点击入群链接）`;
  return buildTextReplyXml(toUser, fromUser, text);
}

/** fire-and-forget：消息存档失败不影响回复（DbClientEffect 由 AppConfigService 派生） */
function forkArchive(program: Effect.Effect<void, Error, AppConfigService>, appConfig: AppConfig): void {
  Effect.runFork(
    program.pipe(
      Effect.provideService(AppConfigService, appConfig),
      Effect.catch((e) => Effect.logWarning(`${LOG_PREFIX} 消息存档失败（忽略）: ${extractErrorMessage(e)}`)),
    ),
  );
}

/**
 * 注册微信公众号服务器路由（明文兼容模式）：
 * - GET /wechat  服务器配置验证（echostr 回显）
 * - POST /wechat 接收用户消息并被动回复
 * 未配置 config.wechat 时整体不注册
 */
export function registerWechatRoutes(fastify: FastifyInstance, appConfig: AppConfig): void {
  const maybeConfig = appConfig.wechat;
  if (!maybeConfig) {
    wechatLog('未配置 wechat（appId/appSecret/token），/wechat 路由未注册');
    return;
  }
  const config: { appId: string; appSecret: string; token: string } = maybeConfig;

  // 微信回调以 text/xml POST，注册原始字符串解析器
  fastify.addContentTypeParser(['text/xml', 'application/xml'], { parseAs: 'string' }, (_req, body, done) => {
    done(null, body);
  });

  /** 签名校验（GET/POST 都带） */
  function signatureOk(req: FastifyRequest): boolean {
    const q = req.query as Record<string, string>;
    return verifyWechatSignature(config, q.timestamp ?? '', q.nonce ?? '', q.signature ?? '');
  }

  fastify.get('/wechat', async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as Record<string, string>;
    if (!signatureOk(req)) {
      wechatLog('GET 签名校验失败', req.ip);
      reply.code(403).send({ error: '签名校验失败' });
      return;
    }
    wechatLog('服务器配置验证通过');
    reply.type('text/plain').send(q.echostr ?? '');
  });

  fastify.post('/wechat', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!signatureOk(req)) {
      wechatLog('POST 签名校验失败', req.ip);
      reply.code(403).send({ error: '签名校验失败' });
      return;
    }
    const body = typeof req.body === 'string' ? req.body : '';
    const msg = parseWechatMessage(body);
    const toUser = msg.FromUserName ?? '';
    const fromUser = msg.ToUserName ?? '';
    wechatLog(`收到消息 from=${toUser} type=${msg.MsgType} content=${msg.Content ?? ''}`);

    /** 入站消息全量存档（含事件，fire-and-forget） */
    if (toUser) {
      forkArchive(
        archiveMessage({
          channel: 'WECHAT_OFFICIAL',
          direction: 'IN',
          msgType: msg.MsgType ?? 'unknown',
          peerId: toUser,
          content: msg.Content ?? undefined,
          mediaId: msg.MediaId ?? undefined,
        }),
        appConfig,
      );
    }

    if (msg.MsgType === 'text' && msg.Content && msg.MsgId) {
      const content = msg.Content;
      /** 口令验证优先于指令与关键词出码：命中则回填 openid 并提示回网页完成操作 */
      const passcodeVerified = await runEffect(
        PasscodeService.verify('WECHAT_OFFICIAL', content.trim(), toUser),
        appConfig,
        false,
      );
      if (passcodeVerified) {
        wechatLog(`口令验证成功 openid=${toUser.slice(0, 8)}***`);
        const replyText = '✅ 验证成功！请回到网页继续操作';
        forkArchive(
          archiveMessage({
            channel: 'WECHAT_OFFICIAL',
            direction: 'OUT',
            msgType: 'text',
            peerId: toUser,
            content: replyText,
          }),
          appConfig,
        );
        reply.type('application/xml').send(buildTextReplyXml(toUser, fromUser, replyText));
        return;
      }
      /** `/` 前缀指令次优先；非指令（null）继续走关键词出码 */
      const commandReply = await runEffect(handleTextCommand(toUser, content), appConfig, null);
      if (commandReply !== null) {
        forkArchive(
          archiveMessage({
            channel: 'WECHAT_OFFICIAL',
            direction: 'OUT',
            msgType: 'text',
            peerId: toUser,
            content: commandReply,
          }),
          appConfig,
        );
        reply.type('application/xml').send(buildTextReplyXml(toUser, fromUser, commandReply));
        return;
      }
      const xml = await cachedReply(`${toUser}:${msg.MsgId}`, () =>
        handleTextMessage(appConfig, toUser, fromUser, content, baseUrlOf(req)),
      );
      reply.type('application/xml').send(xml);
      return;
    }

    /** 图片消息：有待图会话的操作员上传（群码/公众号码），否则不回复 */
    if (msg.MsgType === 'image' && msg.MediaId && msg.MsgId) {
      const mediaId = msg.MediaId;
      const imageReplyText = await cachedReply(`cmd-image:${toUser}:${msg.MsgId}`, () =>
        (async () => {
          const result = await runEffect(
            handleImageMessage(toUser, () => downloadMediaImage(config, mediaId)),
            appConfig,
            null,
          );
          return result;
        })(),
      );
      if (imageReplyText !== null) {
        forkArchive(
          archiveMessage({
            channel: 'WECHAT_OFFICIAL',
            direction: 'OUT',
            msgType: 'text',
            peerId: toUser,
            content: imageReplyText,
          }),
          appConfig,
        );
        reply.type('application/xml').send(buildTextReplyXml(toUser, fromUser, imageReplyText));
        return;
      }
      reply.type('text/plain').send('success');
      return;
    }

    // 事件：subscribe 关注回复引导
    if (msg.MsgType === 'event' && msg.Event === 'subscribe') {
      const keyword = appConfig.groupEntry?.replyKeyword || '加群';
      const xml = buildTextReplyXml(toUser, fromUser, `欢迎关注～回复「${keyword}」获取最新入群二维码`);
      reply.type('application/xml').send(xml);
      return;
    }
    // 其余消息类型：空串表示"不回复"
    reply.type('text/plain').send('success');
  });

  wechatLog('微信公众号路由已注册: GET/POST /wechat');
}
