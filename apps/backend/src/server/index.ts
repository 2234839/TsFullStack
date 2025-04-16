import fastifyCors from '@fastify/cors';
import { Effect, Either, Logger, Layer } from 'effect';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { Readable } from 'stream';
import { apis, type API } from '../api';
import { appApis } from '../api/appApi';
import { createRPC } from '../rpc';
import { AuthService } from '../service';
import { UnknownException } from 'effect/Cause';
import { PrismaClientKnownRequestError } from '../../prisma/client/runtime/library';
import superjson from 'superjson';
import { getPrisma } from '../db';

// ========== 类型定义 ==========
type ApiHandlerParams = {
  method: string;
  params: any;
  request: FastifyRequest;
  reply: FastifyReply;
};

type ApiHandlerContext = {
  x_token_id?: string;
  db?: any;
  user?: any;
};

// ========== 工具函数 ==========
function createLoggerLayer(): Layer.Layer<never, never, never> {
  const logger = Logger.make(({ logLevel, message }) => {
    console.log(`[${logLevel.label}]`, ...(Array.isArray(message) ? message : [message]));
  });
  return Logger.replace(Logger.defaultLogger, logger);
}

function handleError(error: unknown) {
  if (typeof error === 'string') {
    return { error: { message: error } };
  }

  if (error instanceof UnknownException) {
    const targetErr = error.error;

    if (targetErr instanceof Error && targetErr.name === 'PrismaClientKnownRequestError') {
      const err = targetErr as PrismaClientKnownRequestError;
      if (err?.meta && 'reason' in err.meta) {
        if (err.meta?.reason === 'ACCESS_POLICY_VIOLATION') {
          return { error: { message: '权限不足' } };
        }
        return { error: { message: err.meta.reason } };
      }
      return { error: { message: '数据模型调用错误' } };
    }
  }

  if (error instanceof Error) {
    return { error };
  }

  return { error: { message: '未知错误' } };
}

// ========== 路由处理 ==========
// 服务端鉴权 api 调用，需要用户具有有效的 x_token_id 才能使用
const apisRpc = createRPC('apiProvider', { genApiModule: async () => apis });
async function handleApiRoute({ method, params, request, reply }: ApiHandlerParams) {
  const x_token_id = request.headers['x-token-id'];
  if (typeof x_token_id !== 'string') {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const startTime = Date.now();
  try {
    const { db, user } = await getPrisma({ x_token_id });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise(() => apisRpc.RC(method, params));
        const endTime = Date.now();

        yield* Effect.log(`call:[${endTime - startTime}ms]`, method, params);

        if (Effect.isEffect(result)) {
          return yield* result;
        }
        return result;
      }).pipe(
        Effect.provide(createLoggerLayer()),
        Effect.provideService(AuthService, { x_token_id, db, user }),
      ),
    );
    reply.send(superjson.serialize({ result }));
  } catch (error) {
    reply.send(superjson.serialize(handleError(error)));
  }
}
const appApisRpc = createRPC('apiProvider', { genApiModule: async () => appApis });
async function handleAppApiRoute({ method, params, reply }: ApiHandlerParams) {
  try {
    const startTime = Date.now();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise(() => appApisRpc.RC(method, params));
        const endTime = Date.now();

        yield* Effect.log(`call:[${endTime - startTime}ms]`, method, params);

        if (Effect.isEffect(result)) {
          return yield* result;
        }
        return result;
      }).pipe(Effect.provide(createLoggerLayer())),
    );
    reply.send(superjson.serialize({ result }));
  } catch (error) {
    reply.send(superjson.serialize(handleError(error)));
  }
}

// ========== 服务器初始化 ==========
export async function startServer() {
  const fastify = Fastify({ logger: false });

  // 中间件
  fastify.register(fastifyCors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  fastify.addContentTypeParser('application/octet-stream', (_request, payload, _done) => {
    return Readable.toWeb(payload);
  });

  // 路由
  fastify.all('/api/*', async (request, reply) => {
    await handleApiRoute({
      method: request.url.slice('/api/'.length),
      params: request.body,
      request,
      reply,
    });
  });

  fastify.all('/app-api/*', async (request, reply) => {
    await handleAppApiRoute({
      method: request.url.slice('/app-api/'.length),
      params: request.body,
      request,
      reply,
    });
  });

  // 启动服务器
  try {
    const address = await fastify.listen({ port: 5209, host: '0.0.0.0' });
    console.log(`Server listening on ${address}`);
  } catch (err) {
    console.error('Server startup error:', err);
    process.exit(1);
  }
}
