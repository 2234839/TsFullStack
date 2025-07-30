import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { LogLevel } from '@zenstackhq/runtime/models';
import { Effect, Queue } from 'effect';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import os from 'os';
import path from 'path/posix';
import superjson, { type SuperJSONResult } from 'superjson';
import { apis, type APIRaw } from '../api';
import { FileWarpItem } from '../api/api/file';
import { appApis } from '../api/appApi';
import { SessionAuthSign } from '../lib';
import { createRPC } from '../rpc';
import { AuthService } from '../service/Auth';
import { ReqCtxService, type ReqCtx } from '../service/ReqCtx';
import { systemLog } from '../service/SystemLog';
import { MsgError } from '../util/error';
import { getAuthFromCache } from './authCache';

const MAX_WAIT_MS = 360_000;
const MAX_FILE_SIZE = 1000 * 1024 * 1024; // 1GB
const SERVER_PORT = 5209;

function handleError(error: unknown) {
  if (error instanceof MsgError) {
    return { message: error.message, op: error.op };
  }
  if (error instanceof PrismaClientKnownRequestError) {
    const reason = error.meta?.reason as string;
    if (reason === 'ACCESS_POLICY_VIOLATION') {
      return { message: '权限不足' };
    }
    return { message: reason || '数据模型调用错误' };
  }
  return { message: error instanceof Error ? error.message : '未知错误' };
}

function parseParams(req: FastifyRequest): Promise<any[]> {
  const contentType = req.headers['content-type'];
  if (contentType === 'application/json') {
    return Promise.resolve(superjson.deserialize(req.body as SuperJSONResult) as any[]);
  }
  if (contentType?.startsWith('multipart/form-data')) {
    // 在接口中使用 ReqCtx 获取值（为了文件流的优化）
    return Promise.resolve([]);
  }
  if (req.method === 'GET') {
    const query = req.query as { args?: string };
    return Promise.resolve(query.args ? superjson.parse(query.args) as any[] : []);
  }
  throw MsgError.msg('Unknown content type:' + contentType);
}
function parseParamsAndAuth(req: FastifyRequest) {
  return Effect.gen(function* () {
    const query = req.query as { args?: string; sign?: string; session?: string };
    const querySignMode = req.method === 'GET';

    const opt = querySignMode
      ? { sessionID: Number(query.session) }
      : { sessionToken: req.headers['x-token-id'] as string };

    const { db, user } = yield* getAuthFromCache(opt);

    if (querySignMode) {
      const session = user.userSession[0];
      if (!session) {
        throw new MsgError(MsgError.op_toLogin, '请提供有效的 session');
      }
      const verify = yield* Effect.promise(() =>
        SessionAuthSign.verifySignByToken(query.args || '', session.token, query.sign || '')
      );
      if (!verify) {
        throw new MsgError(MsgError.op_msgError, '签名验证失败');
      }
    }

    const params = yield* Effect.promise(() => parseParams(req));
    return { params, db, user };
  });
}

type ApiCtx = {
  req: FastifyRequest;
  reply: FastifyReply;
  pathPrefix: string;
  onEnd: () => void;
  enqueueTime: number;
};

function handleRequest(ctx: ApiCtx) {
  const startTime = Date.now();
  const reqCtx: ReqCtx = {
    logs: [],
    log(...args) {
      this.logs.push(args);
    },
    req: ctx.req,
  };

  const method = decodeURIComponent(ctx.req.url.split('?')[0]?.slice(ctx.pathPrefix.length) ?? '');

  const processRequest = Effect.gen(function* () {
    if (Date.now() - ctx.enqueueTime > MAX_WAIT_MS) {
      throw MsgError.msg('请求队列处理积压超时');
    }

    const result = yield* (ctx.pathPrefix === '/app-api/'
      ? handleAppApi(method, ctx.req)
      : handleAuthApi(method, ctx.req)
    );

    if (result instanceof FileWarpItem) {
      yield* Effect.promise(() => sendFileResponse(ctx.reply, result));
    } else {
      yield* Effect.promise(() => {
        ctx.reply.send(superjson.serialize({ result }));
        return Promise.resolve();
      });
    }
  });

  return processRequest
    .pipe(Effect.provideService(ReqCtxService, reqCtx))
    .pipe(Effect.catchAllDefect(defect => {
      reqCtx.log('[error]', `${(defect as Error)?.stack?.split('at Generator.next (<anonymous>)')?.[0]}`);
      ctx.reply.send(superjson.serialize({ error: handleError(defect) }));
      return Effect.succeed('catch');
    }))
    .pipe(Effect.andThen(() => {
      const endTime = Date.now();
      return Effect.gen(function* () {
        yield* systemLog(
          { level: LogLevel.INFO, message: `call:[${endTime - startTime}ms] ${method}` },
          reqCtx
        );
        ctx.onEnd();
      });
    }));
}

function handleAppApi(method: string, req: FastifyRequest) {
  return Effect.gen(function* () {
    const params = yield* Effect.promise(() => parseParams(req));
    const appApisRpc = createRPC('apiProvider', { genApiModule: async () => appApis });
    const resEffect = yield* Effect.promise(() =>
      appApisRpc.RC(method, params).catch(e => {
        throw MsgError.msg('API调用失败: ' + e?.message);
      })
    );
    return Effect.isEffect(resEffect) ? yield* resEffect : resEffect;
  });
}

function handleAuthApi(method: string, req: FastifyRequest) {
  return Effect.gen(function* () {
    const { params, db, user } = yield* parseParamsAndAuth(req);
    const apisRpc = createRPC('apiProvider', {
      genApiModule: async () => ({ ...apis, db } as unknown as APIRaw),
    });
    const resEffect = yield* Effect.promise(() =>
      apisRpc.RC(method, params).catch(e => {
        throw MsgError.msg('API调用失败: ' + e?.stack);
      })
    );
    const result = Effect.isEffect(resEffect) ? yield* resEffect : resEffect;
    return { result, db, user };
  }).pipe(Effect.andThen(({ result, db, user }) =>
    Effect.succeed(result).pipe(Effect.provideService(AuthService, { db, user }))
  ));
}

function sendFileResponse(reply: FastifyReply, result: FileWarpItem): Promise<void> {
  return new Promise((resolve) => {
    reply
      .type(result.model.mimetype || 'application/octet-stream')
      .header('Content-Disposition', `inline; filename="${encodeURIComponent(result.model.filename)}"`)
      .header('Content-Length', result.model.size)
      .send(result.getFileSteam());
    resolve();
  });
}
// 服务器初始化
export const startServer = Effect.gen(function* () {
  const fastify = Fastify({ logger: false });

  //#region fastify 注册中间件:cors Multipart static
  fastify.register(fastifyCors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  fastify.register(fastifyMultipart, {
    limits: { fileSize: MAX_FILE_SIZE },
  });
  console.log('[static]', path.join(__dirname, 'frontend'));
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'frontend'),
    prefix: '/',
  });
  //#endregion

  const queue = yield* Queue.unbounded<ApiCtx>();
  const emitReq = (ctx: ApiCtx) => Effect.runPromise(Queue.offer(queue, ctx));

  function registerRoute(pathPrefix: string) {
    return async function (req: FastifyRequest, reply: FastifyReply) {
      let resolved = false;
      const p = new Promise<void>((resolve) => {
        const onceResolve = () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };
        emitReq({
          req,
          reply,
          pathPrefix,
          enqueueTime: Date.now(),
          onEnd: onceResolve,
        });
      });
      await p;
    };
  }

  fastify.all('/api/*', registerRoute('/api/'));
  fastify.all('/app-api/*', registerRoute('/app-api/'));

  // 处理 SPA 路由回退
  fastify.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/api') && !request.url.startsWith('/app-api')) {
      reply.sendFile('index.html');
    } else {
      reply.code(404).send({ error: 'Not Found' });
    }
  });

  const address = yield* Effect.tryPromise({
    try: () => fastify.listen({ port: SERVER_PORT, host: '0.0.0.0' }),
    catch(error) {
      console.error('Server startup error:', error);
      return undefined;
    },
  });

  if (!address) {
    throw new Error('Server failed to start');
  }
  console.log(`Server listening on ${address}`);

  const concurrency = os.cpus().length * 10;
  console.log(`设置的请求并发上限为:${concurrency}`);
  const semaphore = yield* Effect.makeSemaphore(concurrency);

  while (true) {
    const ctx = yield* Queue.take(queue);
    yield* Effect.forkDaemon(
      semaphore.withPermits(1)(
        handleRequest(ctx).pipe(
          Effect.catchAll((err) => Effect.logError(`[handleRequest error] ${String(err)}`)),
          Effect.ensuring(Effect.sync(ctx.onEnd))
        )
      )
    );
  }
});
