import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { Cause, Effect, Exit } from 'effect';
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
    if (!file) throw new Error('No file uploaded');
    const buffer = await file.toBuffer();
    const fileObject = new File([buffer], file.filename, { type: file.mimetype });
    return [fileObject];
  } else {
    throw new Error('Unknown content type:' + contentType);
  }
}

// 处理需要鉴权的 API
async function handleApi(
  method: string,
  params: any[],
  reqCtx: ReqCtx,
  request: FastifyRequest,
): Promise<Exit.Exit<unknown, unknown>> {
  let x_token_id = request.headers['x-token-id'];

  if (typeof x_token_id !== 'string') {
    return Exit.fail(new MsgError(MsgError.op_toLogin, '请提供有效的 x_token_id'));
  }

  const { db, user } = await getAuthFromCache(x_token_id);
  reqCtx.user = user;
  const apisRpc = createRPC('apiProvider', {
    genApiModule: async () => ({ ...apis, db } as unknown as APIRaw),
  });
  const p = Effect.gen(function* () {
    const result = yield* Effect.promise(() =>
      apisRpc.RC(method, params).catch((e) => {
        throw new MsgError(MsgError.op_msgError, 'API调用失败: ' + e?.message);
      }),
    );
    if (Effect.isEffect(result)) {
      return yield* result;
    }
    return result;
  }).pipe(Effect.provideService(AuthService, { x_token_id, db, user }));
  return Effect.runPromiseExit(p);
}

// 处理无需鉴权的 API
async function handleAppApi(
  method: string,
  params: any[],
  reqCtx: ReqCtx,
): Promise<Exit.Exit<unknown, unknown>> {
  const appApisRpc = createRPC('apiProvider', { genApiModule: async () => appApis });
  return Effect.runPromiseExit(
    Effect.gen(function* () {
      const result = yield* Effect.promise(() =>
        appApisRpc.RC(method, params).catch((e) => {
          throw new MsgError(MsgError.op_msgError, 'API调用失败: ' + e?.message);
        }),
      );
      if (Effect.isEffect(result)) {
        return yield* result;
      }
      return result;
    }).pipe(Effect.provideService(ReqCtxService, reqCtx)),
  );
}

// 创建 API 处理函数
function createAPIHandler(
  pathPrefix: string,
  handler: (
    method: string,
    params: any[],
    reqCtx: ReqCtx,
    request: FastifyRequest,
  ) => Promise<Exit.Exit<unknown, unknown>>,
) {
  return async function apiHandler(request: FastifyRequest, reply: FastifyReply) {
    const startTime = Date.now();
    const reqCtx = {
      reqId: uuidv7(),
      logs: [],
      log(...args) {
        this.logs.push(args);
      },
    } satisfies ReqCtx;
    const method = request.url.split('?')[0]?.slice(pathPrefix.length) ?? '';

    const p = Effect.gen(function* () {
      const params = yield* Effect.promise(() => parseParams(request));
      reqCtx.log('params', params);
      // 这里返回的就是一个  exit
      return yield* Effect.promise(() => handler(method, params, reqCtx, request));
    });

    // 这里会是嵌套 Exit 所以需要展开
    const exit = await Effect.runPromiseExit(p);
    const exitFlatten = Exit.flatten(exit);

    const r = Exit.match(exitFlatten, {
      onSuccess: (result) => {
        if (result instanceof File) {
          reply.type(result.type || 'application/octet-stream');
          // 设置文件名
          reply.header(
            'Content-Disposition',
            `attachment; filename="${encodeURIComponent(result.name)}"`,
          );
          return reply.send(result.stream());
        } else {
          return reply.send(superjson.serialize({ result }));
        }
      },
      onFailure: (cause) => {
        const error = Cause.match(cause, {
          onEmpty: '(empty)',
          onFail: (error) => `(error: ${error})`,
          onDie: (defect) => defect,
          onInterrupt: (fiberId) => `(fiberId: ${fiberId})`,
          onSequential: (left, right) => `(onSequential (left: ${left}) (right: ${right}))`,
          onParallel: (left, right) => `(onParallel (left: ${left}) (right: ${right})`,
        });
        // @ts-ignore
        reqCtx.log('[error]', error);

        return reply.send(superjson.serialize({ error: handleError(error) }));
      },
    });

    const endTime = Date.now();
    systemLog(
      { level: LogLevel.INFO, message: `call:[${endTime - startTime}ms] ${method}` },
      reqCtx,
    );
    return r;
  };
}

// 服务器初始化
export async function startServer() {
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

  // 注册路由
  fastify.all('/api/*', createAPIHandler('/api/', handleApi));
  fastify.all('/app-api/*', createAPIHandler('/app-api/', handleAppApi));

  // 处理 SPA 路由回退
  fastify.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/api') && !request.url.startsWith('/app-api')) {
      reply.sendFile('index.html');
    } else {
      reply.code(404).send({ error: 'Not Found' });
    }
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
