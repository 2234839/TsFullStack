import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Effect } from 'effect';
import { PaymentService } from '../services/payment/PaymentService';
import { PaymentProvider } from '../../.zenstack/models';
import { ReqCtxService, type ReqCtx } from '../Context/ReqCtx';
import { AppConfigService, type AppConfig } from '../Context/AppConfig';
import { PaymentConfigService } from '../Context/PaymentConfig';
import { extractErrorMessage } from '../util/error';
import { WEBHOOK_MAX_LOG_PAYLOAD } from '../util/constants';

/** 日志前缀 */
const LOG_PREFIX = '[Webhook]';

/**
 * 注册 Webhook 回调路由
 */
export function registerWebhookRoutes(fastify: FastifyInstance, appConfig: AppConfig) {
  fastify.post('/webhook/mbd', async (req: FastifyRequest, reply: FastifyReply) => {
    return handleWebhookRequest(PaymentProvider.MBD, appConfig, req, reply);
  });

  fastify.post('/webhook/afdian', async (req: FastifyRequest, reply: FastifyReply) => {
    return handleWebhookRequest(PaymentProvider.AFDIAN, appConfig, req, reply);
  });
}

/** 统一 Webhook 请求处理器 */
async function handleWebhookRequest(
  provider: PaymentProvider,
  appConfig: AppConfig,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const startTime = Date.now();

  const reqCtx: ReqCtx = {
    logs: [],
    log(...args) {
      reqCtx.logs.push(args);
    },
    req,
    reqId: 0,
    /** webhook 无队列，起点即当前时刻 */
    t0: performance.now(),
    sqlEvents: [],
  };

  try {
    const payload = (typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const headers = req.headers as Record<string, string>;

    reqCtx.log(`${LOG_PREFIX} 收到 ${provider} 回调`, JSON.stringify(payload).slice(0, WEBHOOK_MAX_LOG_PAYLOAD));

    const program = PaymentService.handleWebhook(provider, payload, headers).pipe(
      Effect.provideService(ReqCtxService, reqCtx),
    );

    /** 显式补全 R 通道：DbClientEffect 依赖 AppConfigService，ReqCtxService 用于日志追踪，无需 as 强转 */
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provideService(AppConfigService, appConfig),
        Effect.provideService(PaymentConfigService, appConfig.payment ?? {}),
      ),
    );

    const elapsed = Date.now() - startTime;
    reqCtx.log(`${LOG_PREFIX} ${provider} 处理完成 (${elapsed}ms):`, JSON.stringify(result));

    if (provider === PaymentProvider.MBD) {
      reply.send({ code: 0, msg: 'success' });
    } else {
      reply.send({ ec: 200, em: 'ok' });
    }
  } catch (error: unknown) {
    const elapsed = Date.now() - startTime;
    reqCtx.log(`${LOG_PREFIX} ${provider} 处理失败 (${elapsed}ms):`, extractErrorMessage(error));

    if (provider === PaymentProvider.MBD) {
      reply.code(500).send({ code: -1, msg: 'error' });
    } else {
      reply.code(500).send({ ec: 500, em: 'error' });
    }
  }
}
