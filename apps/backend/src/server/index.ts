import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { ORMError, ORMErrorReason } from '@zenstackhq/orm';
import { Cause, Effect, Exit, Layer, Queue } from 'effect';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import os from 'os';
import path from 'path';
import superjson, { type SuperJSONResult } from 'superjson';
import { fileURLToPath } from 'url';
import { LogLevel } from '../../.zenstack/models';
import { AuthContext } from '../Context/Auth';
import { ReqCtxService, type ReqCtx } from '../Context/ReqCtx';
import { systemLog } from '../Context/SystemLog';
import { GithubAuthLive } from '../OAuth/github';
import { apis, type APIRaw } from '../api';
import { appApis } from '../api/appApi';
import { FileWrapItem } from '../api/authApi/file';
import { verifySignByToken } from '../lib/SessionAuthSign';
import { createRPC } from '../rpc';
import { MsgError } from '../util/error';
import { FetchWithProxy } from '../util/github-proxy';
import {
  createDetailedErrorMessage,
  isRecordNotFoundError,
  isZenStackPermissionError,
  isZenStackValidationError,
} from '../util/zenstack-error';
import { getAuthFromCache } from './authCache';
import { CORS_MAX_AGE_SECONDS, MAX_UPLOAD_BYTES, SERVER_PORT, SERVER_HOST, MAX_WAIT_MS } from '../util/constants';

// ESM 模块中获取 __dirname 的替代方案
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 统一错误序列化函数
function handleCause(cause: Cause.Cause<unknown>) {
  let err;
  function setErr(error: unknown): string {
    if (MsgError.isMsgError(error)) {
      err = { message: error.message, op: error.op };
    } else if (error instanceof ORMError) {
      /**
       * https://zenstack.dev/docs/orm/access-control/query#setting-auth-user
       * Mutation operations that affect a single, unique row, like update and delete, will throw an ORMError with reason set to NOT_FOUND if the target row doesn't meet the "update" or "delete" policies respectively. See Errors for more details.
       * Why set reason as NOT_FOUND instead of REJECTED_BY_POLICY? Because the rationale is rows that don't satisfy the policies "don't exist".
       */
      if (error.reason === ORMErrorReason.NOT_FOUND) {
        err = { message: '无权访问/修改或记录不存在' };
      } else if (
        /** 检查是否为 Prisma/ZenStack 的 P2004 或 P2025 错误 */
        isZenStackPermissionError(error)
      ) {
        err = { message: '权限不足' };
      } else if (isRecordNotFoundError(error)) {
        err = { message: '记录不存在或已被删除' };
      } else if (isZenStackValidationError(error)) {
        err = { message: '数据验证失败，请检查输入' };
      } else {
        // 其他错误，使用第一行错误消息
        err = { message: error.message.split('\n')[0] };
      }
    } else {
      err = { message: String(error) };
    }
    return String(error); // Cause.match 回调要求返回 string，值虽不被使用但类型必须匹配
  }
  let CauseMsg = Cause.match(cause, {
    onEmpty: '(empty)',
    onFail: setErr,
    onDie: setErr,
    onInterrupt: (fiberId) => `(fiberId: ${fiberId})`,
    onSequential: (left, right) => `(onSequential (left: ${left}) (right: ${right}))`,
    onParallel: (left, right) => `(onParallel (left: ${left}) (right: ${right})`,
  });

  if (err) {
    return err;
  }
  return { message: CauseMsg };
}

// 参数解析函数
async function parseParams(req: FastifyRequest): Promise<unknown[]> {
  const contentType = req.headers['content-type'];
  if (contentType === 'application/json') {
    return superjson.deserialize(req.body as SuperJSONResult) as unknown[];
  } else if (contentType?.startsWith('multipart/form-data')) {
    // 在接口中使用 ReqCtx 获取值（为了文件流的优化）
    return [];
  } else if (req.method === 'GET') {
    const query = req.query as {
      args?: string;
      sign?: string;
      session?: string;
    };
    return query.args ? (superjson.parse(query.args) as unknown[]) : [];
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

    // 只使用安全的认证方式
    if (query.session && querySignMode) {
      opt.sessionID = Number(query.session);
    } else {
      // 使用请求头进行认证
      const rawToken = req.headers['x-token-id'];
      opt.sessionToken = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    }

    const { db, user } = yield* getAuthFromCache(opt);

    if (querySignMode) {
      const session = user.userSession[0];
      if (!session) {
        throw new MsgError(MsgError.op_toLogin, '请提供有效的 session');
      }
      const verify = yield* Effect.try({
        try: () => verifySignByToken(query.args || '', session.token, query.sign || ''),
        catch: (e) => MsgError.msg('签名验证失败: ' + String(e)),
      });
      if (!verify) {
        throw new MsgError(MsgError.op_msgError, '签名验证失败');
      }
    }
    const params = yield* Effect.tryPromise({
      try: () => parseParams(req),
      catch: (e) => MsgError.msg('参数解析失败: ' + String(e)),
    });
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
/** rpc 实例，提到外部可避免每次重新创建 */
const appApisRpc = createRPC('apiProvider', { genApiModule: async () => appApis });
let reqId = 0
/** 注意，这里必须要等待发送数据完毕，否则 onEnd 之后数据将无法发送 */
function handleReq({ req, reply, pathPrefix, enqueueTime, onEnd }: apiCtx) {
  const startTime = Date.now();
  const reqCtx: ReqCtx = {
    logs: [],
    log(...args) {
      reqCtx.logs.push(args);
    },
    req,
    reqId: ++reqId,
  };
  const method = decodeURIComponent(req.url.split('?')[0]?.slice(pathPrefix.length) ?? '');
  const program = Effect.gen(function* () {
    const waitTime = Date.now() - enqueueTime;
    if (waitTime > MAX_WAIT_MS) {
      throw MsgError.msg('服务器繁忙，请稍后再试');
    }

    let result: unknown;
    if (pathPrefix === '/app-api/') {
      const params = yield* Effect.tryPromise({
        try: () => parseParams(req),
        catch: (e) => { throw MsgError.msg('参数解析失败: ' + String(e)); },
      });
      result = yield* Effect.gen(function* () {
        const res_effect = yield* Effect.tryPromise({
          try: () => appApisRpc.RC(method, params),
          catch: (e) => { throw MsgError.msg('RPC 调用失败: ' + String(e)); },
        });
        const res = Effect.isEffect(res_effect) ? yield* res_effect : res_effect;
        return res;
      });
    } else if (pathPrefix === '/api/') {
      // 处理需要鉴权的 API
      const { params, db, user } = yield* parseParamsAndAuth(req);
      result = yield* Effect.gen(function* () {
        const apisRpc = createRPC('apiProvider', {
          genApiModule: async () => ({ ...apis, db }) as unknown as APIRaw,
        });
        const res_effect = yield* Effect.tryPromise({
          try: () => apisRpc.RC(method, params),
          catch: (e) => { throw MsgError.msg('RPC 调用失败: ' + String(e)); },
        });
        const res = Effect.isEffect(res_effect) ? yield* res_effect : res_effect;
        return res;
      })
        // 提供 apis 模块所需要的依赖
        .pipe(Effect.provideService(AuthContext, { db, user }));
    }
    if (result instanceof FileWrapItem) {
      // 设置文件名
      reply
        .type(result.model.mimetype || 'application/octet-stream')
        .header(
          'Content-Disposition',
          `inline; filename="${encodeURIComponent(result.model.filename)}"`,
        )
        .header('Content-Length', result.model.size);
      yield* Effect.promise(async () => reply.send(result.getFileStream()));
    } else {
      yield* Effect.promise(async () => reply.send(superjson.serialize({ result })));
    }
  });
  // 合成层，避免其他 service 还在依赖 FetchWithProxy
  const unFetchProxyLayer = Layer.provide(GithubAuthLive, FetchWithProxy.Default);

  const reqLayer = Layer.succeed(ReqCtxService, reqCtx);
  /** 合成层，避免其他 service 还在依赖 ReqCtxService  */
  const unReqLayer = Layer.provide(unFetchProxyLayer, reqLayer);

  const apiLayer = unReqLayer;
  const runnable = Effect.provide(program, [
    apiLayer,
    /**
    Q:为什么这里还要传递 reqLayer，前面已经传递了 unReqLayer (apiLayer) 啊？
    A:要注意 unReqLayer 解决的是 unReqLayer 这个声明中的层依赖 ReqCtxService 的问题，但是并没有给 program 提供 ReqCtxService，所以这里主要就是给 program 提供
      理论上就可以不要使用 unReqLayer 了,但为了代码逻辑清晰还是使用 unReqLayer
    */ reqLayer,
  ]);

  // 拦截并处理所有错误
  return Effect.gen(function* () {
    const exit = yield* Effect.exit(runnable);
    if (Exit.isFailure(exit)) {
      const cause = exit.cause;

      // 记录详细的错误信息
      if (Cause.isDieType(cause)) {
        const defect = cause.defect;
        const defectStack = defect instanceof Error
          ? defect.stack?.split('at Generator.next (<anonymous>)')?.[0]
          : String(defect);
        reqCtx.log(
          '[error Cause]',
          /** 裁剪掉 Effect 内部的调用堆栈 */
          defectStack ?? 'unknown',
        );

        // 额外记录 ZenStack/Prisma 错误的详细信息
        if (defect) {
          const detailedMsg = createDetailedErrorMessage(defect, method);
          if (detailedMsg.includes('ZenStack') || detailedMsg.includes('P2025')) {
            reqCtx.log('[error details]', detailedMsg);
          }
        }
      } else {
        reqCtx.log('[error noCause]', `${cause}`);
      }

      reply.send(superjson.serialize({ error: handleCause(cause) }));
    }

    onEnd();
    const endTime = Date.now();
    return yield* systemLog(
      { level: LogLevel.INFO, message: `${endTime - startTime}ms ${method}` },
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
    allowedHeaders: ['Content-Type', 'x-token-id'],
    exposedHeaders: ['Content-Length'],
    credentials: false,
    maxAge: CORS_MAX_AGE_SECONDS, // 预检请求结果缓存24小时
  });
  fastify.register(fastifyMultipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES }, // 1GB
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

  //#region 启动服务器
  const address = yield* Effect.tryPromise({
    try: () => fastify.listen({ port: SERVER_PORT, host: SERVER_HOST }),
    catch(error: unknown) {
      console.error('Server startup error:', error);
      return undefined;
    },
  });

  if (!address) {
    throw MsgError.msg('Server failed to start');
  }
  console.log(`Server listening on ${address}`);
  //#endregion

  // 创建控制最大并发数的信号量
  const cpuCount = os.cpus().length;
  const recommendedConcurrency = cpuCount * 10;
  console.log(`设置的请求并发上限为:${recommendedConcurrency}`);

  const semaphore = yield* Effect.makeSemaphore(recommendedConcurrency);

  // 请求队列消费循环
  while (true) {
    const ctx = yield* Queue.take(queue);

    // fork 一个 Fiber 去执行请求处理，确保不会阻塞循环
    yield* Effect.forkDaemon(
      semaphore.withPermits(1)(
        handleReq(ctx).pipe(
          Effect.catchAll((err) => Effect.logError(`[handleReq error] ${String(err)}`)),
          Effect.ensuring(Effect.sync(ctx.onEnd)),
        ),
      ),
    );
  }
});
