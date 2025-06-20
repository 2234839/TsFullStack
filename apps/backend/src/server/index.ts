import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { LogLevel } from '@zenstackhq/runtime/models';
import { Effect, Exit, Queue } from 'effect';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import os from 'os';
import path from 'path/posix';
import superjson, { type SuperJSONResult } from 'superjson';
import { apis, type APIRaw } from '../api';
import { appApis } from '../api/appApi';
import { createRPC } from '../rpc';
import { AuthService } from '../service/Auth';
import { ReqCtxService, type ReqCtx } from '../service/ReqCtx';
import { systemLog } from '../service/SystemLog';
import { MsgError } from '../util/error';
import { getAuthFromCache } from './authCache';

const MAX_WAIT_MS = 360_000;

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

type apiCtx = {
  req: FastifyRequest;
  reply: FastifyReply;
  pathPrefix: string;
  onEnd: () => void;
  enqueueTime: number;
};
function handelReq({ req, reply, pathPrefix, enqueueTime, onEnd }: apiCtx) {
  const startTime = Date.now();
  const reqCtx: ReqCtx = {
    logs: [],
    log(...args) {
      this.logs.push(args);
    },
  };
  const method = decodeURIComponent(req.url.split('?')[0]?.slice(pathPrefix.length) ?? '');
  const p = Effect.gen(function* () {
    const params = yield* Effect.promise(() => parseParams(req));

    const waitTime = Date.now() - enqueueTime;
    if (waitTime > MAX_WAIT_MS) {
      throw MsgError.msg('请求队列处理积压超时');
    }

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
              throw MsgError.msg('API调用失败: ' + e?.stack);
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
    reqCtx.log(
      '[error]',
      /** 裁剪掉 Effect 内部的调用堆栈 */
      `${(defect as Error)?.stack?.split('at Generator.next (<anonymous>)')?.[0]}`,
    );
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

  //#region fastify 注册中间件:cors Multipart static
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
  //#endregion

  // 创建一个无界队列
  const queue = yield* Queue.unbounded<apiCtx>();

  // 解决 Effect 的异步边界问题，也就是创建一个普通的回调函数来将数据传递给外层的 Effect 程序，然后外层程序通过消费队列来处理数据
  // emitReq 将请求放入队列，返回 Promise 以支持 await
  const emitReq = (ctx: apiCtx) => Effect.runPromise(Queue.offer(queue, ctx));

  // onEnd 是为了解决 fastify 的回调函数执行完毕后，fastify 会自动结束请求，而我们希望在 Effect Stream 中处理请求，所以需要维持时机到处理完毕
  // 这个 onEnd 实现的比较丑陋，但是没想到什么好方法解决这个问题
  function registerRoute(pathPrefix: string) {
    return async function (req: FastifyRequest, reply: FastifyReply) {
      let resolved = false;
      const p = new Promise<void>((resolve) => {
        // 包装 resolve，防止多次调用 onEnd
        const onceResolve = () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };
        // 将请求上下文放入队列
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

  // 启动服务器
  const address = yield* Effect.tryPromise({
    try: () => fastify.listen({ port: 5209, host: '0.0.0.0' }),
    catch(error) {
      console.error('Server startup error:', error);
      return undefined;
    },
  });

  if (!address) {
    throw new Error('Server failed to start');
  }
  console.log(`Server listening on ${address}`);

  // 创建控制最大并发数的信号量
  const cpuCount = os.cpus().length;
  const recommendedConcurrency = cpuCount * 10; // 根据cpu核心数设置并发数
  // const recommendedConcurrency = 1; // 测试用
  console.log(`设置的请求并发上限为:${recommendedConcurrency}`);

  const semaphore = yield* Effect.makeSemaphore(recommendedConcurrency);

  // 请求队列消费循环
  while (true) {
    const ctx = yield* Queue.take(queue);

    // fork 一个 Fiber 去执行请求处理，确保不会阻塞循环
    yield* Effect.forkDaemon(
      semaphore.withPermits(1)(
        handelReq(ctx).pipe(
          Effect.catchAll((err) => Effect.logError(`[handelReq error] ${String(err)}`)),
          Effect.ensuring(Effect.sync(ctx.onEnd)),
        ),
      ),
    );
  }
});
