import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { Cause, Chunk, Effect, Exit, Stream, type StreamEmit } from 'effect';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import path from 'path/posix';
import superjson, { type SuperJSONResult } from 'superjson';
import { v7 as uuidv7 } from 'uuid';
import { apis, type APIRaw } from '../api';
import { appApis } from '../api/appApi';
import { createRPC } from '../rpc';
import { AuthService } from '../service/Auth';
import { ReqCtxService, type ReqCtx } from '../service/ReqCtx';
import { MsgError } from '../util/error';
import { getAuthFromCache } from './authCache';
import { systemLog } from '../service/SystemLog';
import { LogLevel } from '@zenstackhq/runtime/models';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AppConfigService, type AppConfig } from '../service/AppConfigService';

// 统一错误序列化函数
function handleError(error: unknown) {
  if (error instanceof MsgError) {
    return { message: error.message, op: error.op };
  }
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.meta && 'reason' in error.meta) {
      if (error.meta.reason === 'ACCESS_POLICY_VIOLATION') {
        return { message: '权限不足' };
      }
      return { message: error.meta.reason as string };
    }
    return { message: '数据模型调用错误' };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: '未知错误' };
}

// 参数解析函数
async function parseParams(request: FastifyRequest): Promise<any[]> {
  const contentType = request.headers['content-type'];
  if (contentType === 'application/json') {
    return superjson.deserialize(request.body as SuperJSONResult) as any[];
  } else if (contentType?.startsWith('multipart/form-data')) {
    const file = await request.file();
    if (!file) throw MsgError.msg('No file uploaded');
    const buffer = await file.toBuffer();
    const fileObject = new File([buffer], file.filename, { type: file.mimetype });
    return [fileObject];
  } else {
    throw MsgError.msg('Unknown content type:' + contentType);
  }
}

type apiCtx = { req: FastifyRequest; reply: FastifyReply; pathPrefix: string; onEnd: () => void };
function handelReq({ req, reply, pathPrefix, onEnd }: apiCtx) {
  const startTime = Date.now();
  const reqCtx: ReqCtx = {
    logs: [],
    log(...args) {
      this.logs.push(args);
    },
  };
  const method = req.url.split('?')[0]?.slice(pathPrefix.length) ?? '';
  const p = Effect.gen(function* () {
    const params = yield* Effect.promise(() => parseParams(req));

    let result;
    if (pathPrefix === '/app-api/') {
      const appApisRpc = createRPC('apiProvider', { genApiModule: async () => appApis });
      result = yield* Effect.gen(function* () {
        const res_effect = yield* Effect.promise(() =>
          appApisRpc.RC(method, params).catch((e) => {
            throw MsgError.msg('API调用失败: ' + e?.message);
          }),
        );
        const res = Effect.isEffect(res_effect) ? yield* res_effect : res_effect;
        return res;
      });
    } else if (pathPrefix === '/api/') {
      // 处理需要鉴权的 API

      let x_token_id = req.headers['x-token-id'];
      if (typeof x_token_id !== 'string') {
        result = Exit.fail(new MsgError(MsgError.op_toLogin, '请提供有效的 x_token_id'));
      } else {
        const { db, user } = yield* Effect.promise(() => getAuthFromCache(x_token_id));
        result = yield* Effect.gen(function* () {
          const apisRpc = createRPC('apiProvider', {
            genApiModule: async () => ({ ...apis, db } as unknown as APIRaw),
          });
          const res_effect = yield* Effect.promise(() =>
            apisRpc.RC(method, params).catch((e) => {
              throw MsgError.msg('API调用失败: ' + e?.message);
            }),
          );

          const res = Effect.isEffect(res_effect) ? yield* res_effect : res_effect;
          return res;
        })
          // 提供 apis 模块所需要的依赖
          .pipe(Effect.provideService(AuthService, { x_token_id, db, user }));
      }
    }
    if (result instanceof File) {
      reply.type(result.type || 'application/octet-stream');
      // 设置文件名
      reply.header(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(result.name)}"`,
      );
      reply.send(result.stream());
    } else {
      reply.send(superjson.serialize({ result }));
    }
  }).pipe(
    // 这里可以提供共用的依赖
    Effect.provideService(ReqCtxService, reqCtx),
  );
  // 拦截并处理所有错误
  return Effect.catchAllDefect(p, (defect) => {
    // @ts-expect-error
    reqCtx.log('[error]', defect);
    reply.send(superjson.serialize({ error: handleError(defect) }));

    return Effect.succeed('catch');
  }).pipe(
    Effect.andThen((res) => {
      const endTime = Date.now();
      systemLog(
        { level: LogLevel.INFO, message: `call:[${endTime - startTime}ms] ${method}` },
        reqCtx,
      );
      onEnd();
    }),
  );
}
// 服务器初始化
export const startServer = Effect.gen(function* () {
  const fastify = Fastify({ logger: false });

  // 注册中间件
  fastify.register(fastifyCors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  fastify.register(fastifyMultipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  });
  console.log('[static]', path.join(__dirname, 'frontend'));
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'frontend'),
    prefix: '/',
  });

  // 将请求转变成 Effect Stream
  let emit: StreamEmit.Emit<never, never, apiCtx, void>;

  const stream = Stream.async((_emit: StreamEmit.Emit<never, never, apiCtx, void>) => {
    emit = _emit;
  }).pipe(Stream.runForEach(handelReq));

  // onEnd 是为了解决 fastify 的回调函数执行完毕后，fastify 会自动结束请求，而我们希望在 Effect Stream 中处理请求，所以需要维持时机到处理完毕
  // 这个 onEnd 实现的比较丑陋，但是没想到什么好方法解决这个问题
  fastify.all('/api/*', async function (req, reply) {
    let onEnd = () => {};
    // @ts-expect-error
    const p = new Promise((r) => (onEnd = r));
    await emit(Effect.succeed(Chunk.of({ req, reply, pathPrefix: '/api/', onEnd })));
    await p;
  });
  fastify.all('/app-api/*', async function (req, reply) {
    let onEnd = () => {};
    // @ts-expect-error
    const p = new Promise((r) => (onEnd = r));
    await emit(Effect.succeed(Chunk.of({ req, reply, pathPrefix: '/app-api/', onEnd })));
    await p;
  });

  // 处理 SPA 路由回退
  fastify.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/api') && !request.url.startsWith('/app-api')) {
      reply.sendFile('index.html');
    } else {
      reply.code(404).send({ error: 'Not Found' });
    }
  });

  // 启动服务器
  const address = yield* Effect.tryPromise({
    try: () => fastify.listen({ port: 5209, host: '0.0.0.0' }),
    catch(error) {
      console.error('Server startup error:', error);
      return undefined;
    },
  });
  console.log(`Server listening on ${address}`);
  yield* stream;
});
