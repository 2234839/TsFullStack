import type { FastifyInstance } from 'fastify';
import { Effect } from 'effect';
import { AppConfigService, type AppConfig } from '../Context/AppConfig';
import { DbClientEffect } from '../Context/DbService';
import { FileAccessService } from '../Context/FileAccessService';
import type { File as FileModel } from '../../.zenstack/models';

/** 日志前缀 */
const LOG_PREFIX = '[Embed]';

/**
 * 判断文件记录是否为合法的树洞 HTML 演示文件：
 * 只有走 uploadHtmlEmbed 专用入口上传（public + text/html + metadata.embedHtml 标记）的文件才允许输出。
 * 帖子里的 embedHtmlId 引用不受信任——serve 侧以此为准，任意 File id 无法借道该路由输出。
 */
function isEmbedHtmlFile(fileRow: FileModel): boolean {
  if (fileRow.mimetype !== 'text/html' || fileRow.status !== 'public') return false;
  const meta: unknown = fileRow.metadata;
  return (
    typeof meta === 'object' && meta !== null && !Array.isArray(meta) && 'embedHtml' in meta && meta.embedHtml === true
  );
}

/**
 * 注册树洞 HTML 演示文件的沙箱输出路由（免鉴权 GET，供 iframe src 与直接分享链接使用）。
 *
 * 安全设计（核心）：
 * - 响应强制 `Content-Security-Policy: sandbox allow-scripts`：即使受害者直接顶层打开该 URL，
 *   浏览器也将文档置于 opaque origin——读不到本站 cookie/localStorage/DOM、发不出带凭证的同源请求。
 *   这是「别人上传恶意 HTML 也不能 K 其他用户账号」的关键防线，与前端 iframe sandbox 属性互为冗余。
 * - `frame-ancestors 'self'`：仅允许本站页面嵌入，防止第三方站点 iframe 套娃。
 * - 该路径在全局 onSend 安全头 hook 中豁免（否则全站 CSP 会覆盖掉这里的 sandbox 指令）。
 */
export function registerEmbedRoutes(fastify: FastifyInstance, appConfig: AppConfig) {
  fastify.get('/embed/:fileId', async (req, reply) => {
    const fileId = Number((req.params as { fileId: string }).fileId);
    if (!Number.isInteger(fileId) || fileId <= 0) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    const fileRow = await Effect.runPromise(
      Effect.gen(function* () {
        const dbClient = yield* DbClientEffect;
        return yield* Effect.tryPromise(() => dbClient.file.findUnique({ where: { id: fileId } }));
      }).pipe(Effect.provideService(AppConfigService, appConfig)),
    ).catch((e) => {
      console.error(`${LOG_PREFIX} 查询文件失败: id=${fileId}`, e);
      return null;
    });

    if (!fileRow || !isEmbedHtmlFile(fileRow)) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    /** 路径安全校验（防目录遍历）+ 流式输出 */
    const wrapItem = await Effect.runPromise(
      Effect.provideService(
        FileAccessService.createFileWrapItemEffect(fileRow, { publicOnly: true }),
        AppConfigService,
        appConfig,
      ),
    ).catch((e) => {
      console.error(`${LOG_PREFIX} 文件访问校验失败: id=${fileId}`, e);
      return null;
    });
    if (!wrapItem) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    reply
      .type('text/html; charset=utf-8')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'public, max-age=3600')
      .header('Content-Security-Policy', "sandbox allow-scripts; frame-ancestors 'self'")
      .header('Content-Length', wrapItem.model.size)
      .send(wrapItem.getFileStream());
  });
}
