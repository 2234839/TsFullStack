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
import { FileWarpItem } from '../api/authApi/file';
import { appApis } from '../api/appApi';
import { SessionAuthSign } from '../lib';
import { createRPC } from '../rpc';
import { AuthContext } from '../Context/Auth';
import { ReqCtxService, type ReqCtx } from '../Context/ReqCtx';
import { systemLog } from '../Context/SystemLog';
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
async function parseParams(req: FastifyRequest): Promise<any[]> {
  const contentType = req.headers['content-type'];
  if (contentType === 'application/json') {
    return superjson.deserialize(req.body as SuperJSONResult) as any[];
  } else if (contentType?.startsWith('multipart/form-data')) {
    // 在接口中使用 ReqCtx 获取值（为了文件流的优化）
    return [];
  } else if (req.method === 'GET') {
    const query = req.query as {
      args?: string;
      sign?: string;
      session?: string;
    };
    return query.args ? (superjson.parse(query.args) as any[]) : [];
  } else {
    throw MsgError.msg('Unknown content type:' + contentType);
  }
}
/** 解析参数并通过参数获取鉴权对象 */
function parseParamsAndAuth(req: FastifyRequest) {
  return Effect.gen(function* () {
    const query = req.query as {
      args?: string;
      sign?: string;
      session?: string;
    };

    const querySignMode = req.method === 'GET';
    const opt: {
      userId?: string;
      email?: string;
      sessionToken?: string;
      sessionID?: number;
    } = {};
    if (query.session && querySignMode) {
      opt.sessionID = Number(query.session);
    } else {
      opt.sessionToken = req.headers['x-token-id'] as string;
    }

    const { db, user } = yield* getAuthFromCache(opt);

    if (querySignMode) {
      const session = user.userSession[0];
      if (!session) {
        throw new MsgError(MsgError.op_toLogin, '请提供有效的 session');
      }
      const verify = yield* Effect.promise(() =>
        SessionAuthSign.verifySignByToken(query.args || '', session.token, query.sign || ''),
      );
      if (!verify) {
        throw new MsgError(MsgError.op_msgError, '签名验证失败');
      }
    }
    const params = yield* Effect.promise(() => parseParams(req));
    return { params, db, user };
  });
}

type apiCtx = {
  req: FastifyRequest;
  reply: FastifyReply;
  pathPrefix: string;
  onEnd: () => void;
  enqueueTime: number;
};

/** 注意，这里必须要等待发送数据完毕，否则 onEnd 之后数据将无法发送 */
function handelReq({ req, reply, pathPrefix, enqueueTime, onEnd }: apiCtx) {
  const startTime = Date.now();
  const reqCtx: ReqCtx = {
    logs: [],
    log(...args) {
      this.logs.push(args);
    },
    req,
  };
  const method = decodeURIComponent(req.url.split('?')[0]?.slice(pathPrefix.length) ?? '');
  const p = Effect.gen(function* () {
    const waitTime = Date.now() - enqueueTime;
    if (waitTime > MAX_WAIT_MS) {
      throw MsgError.msg('请求队列处理积压超时');
    }

    let result: any;
    if (pathPrefix === '/app-api/') {
      const params = yield* Effect.promise(() => parseParams(req));
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
      try {
        const { params, db, user } = yield* parseParamsAndAuth(req);
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
          .pipe(Effect.provideService(AuthContext, { db, user }));
      } catch (error) {
        result = error;
      }
    }
    if (result instanceof FileWarpItem) {
      // 设置文件名
      reply
        .type(result.model.mimetype || 'application/octet-stream')
        .header(
          'Content-Disposition',
          `inline; filename="${encodeURIComponent(result.model.filename)}"`,
        )
        .header('Content-Length', result.model.size);
      yield* Effect.promise(async () => await reply.send(result.getFileSteam()));
    } else {
      yield* Effect.promise(async () => await reply.send(superjson.serialize({ result })));
    }
  }).pipe(
    // 这里可以提供共用的依赖
    Effect.provideService(ReqCtxService, reqCtx),
  );
  // 拦截并处理所有错误
  return Effect.gen(function* () {
    yield* Effect.catchAllDefect(p, (defect) => {
      reqCtx.log(
        '[error]',
        /** 裁剪掉 Effect 内部的调用堆栈 */
        `${(defect as Error)?.stack?.split('at Generator.next (<anonymous>)')?.[0]}`,
      );
      reply.send(superjson.serialize({ error: handleError(defect) }));

      return Effect.succeed('catch');
    });
    onEnd();
    const endTime = Date.now();
    yield* systemLog(
      { level: LogLevel.INFO, message: `call:[${endTime - startTime}ms] ${method}` },
      reqCtx,
    );
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
    limits: { fileSize: 1000 * 1024 * 1024 }, // 1GB
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
