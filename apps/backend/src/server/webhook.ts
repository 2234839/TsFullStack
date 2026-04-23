import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Effect } from 'effect';
import { PaymentService } from '../services/payment/PaymentService';
import { PaymentProvider } from '../../.zenstack/models';
import { ReqCtxService, type ReqCtx } from '../Context/ReqCtx';

/**
 * 注册 Webhook 回调路由
 */
export function registerWebhookRoutes(fastify: FastifyInstance) {
  fastify.post('/webhook/mbd', async (req: FastifyRequest, reply: FastifyReply) => {
    return handleWebhookRequest(PaymentProvider.MBD, req, reply);
  });

  fastify.post('/webhook/afdian', async (req: FastifyRequest, reply: FastifyReply) => {
    return handleWebhookRequest(PaymentProvider.AFDIAN, req, reply);
  });
}

/** 统一 Webhook 请求处理器 */
async function handleWebhookRequest(
  provider: PaymentProvider,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const startTime = Date.now();

  const reqCtx: ReqCtx = {
    logs: [],
    log(...args) { reqCtx.logs.push(args); },
    req,
    reqId: 0,
  };

  try {
    const payload = (typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const headers = req.headers as Record<string, string>;

    reqCtx.log(`[Webhook] 收到 ${provider} 回调`, JSON.stringify(payload).slice(0, 500));

    const program = PaymentService.handleWebhook(provider, payload, headers).pipe(
      Effect.provideService(ReqCtxService, reqCtx),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await Effect.runPromise(program as any);

    const elapsed = Date.now() - startTime;
    reqCtx.log(`[Webhook] ${provider} 处理完成 (${elapsed}ms):`, JSON.stringify(result));

    if (provider === PaymentProvider.MBD) {
      reply.send({ code: 0, msg: 'success' });
    } else {
      reply.send({ ec: 200, em: 'ok' });
    }
  } catch (error: unknown) {
    const elapsed = Date.now() - startTime;
    reqCtx.log(`[Webhook] ${provider} 处理失败 (${elapsed}ms):`, String(error));

    if (provider === PaymentProvider.MBD) {
      reply.send({ code: -1, msg: 'error' });
    } else {
      reply.send({ ec: 500, em: 'error' });
    }
  }
}
