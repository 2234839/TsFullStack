import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { Effect } from 'effect';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import path from 'path/posix';
import superjson, { type SuperJSONResult } from 'superjson';
import { PrismaClientKnownRequestError } from '../../prisma/client/runtime/library';
import { apis, type APIRaw } from '../api';
import { appApis } from '../api/appApi';
import { createRPC } from '../rpc';
import { AuthService } from '../service';
import { MsgError } from '../util/error';
import { getAuthFromCache } from './authCache';

function handleError(error: unknown) {
  if (typeof error === 'string') {
    return { error: { message: error } };
  }
  if ('error' in (error as { error: unknown })) {
    const targetErr = (error as any).error;
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
    if (error instanceof MsgError) {
      return { error: { message: error.message, op: error.op } };
    }
    return { error };
  }

  return { error: { message: '未知错误' } };
}

// 服务端鉴权 api 调用，需要用户具有有效的 x_token_id 才能使用
async function handleApi(
  method: string,
  params: any,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  //#region 根据 token 获取用户鉴权信息，加了缓存
  let x_token_id = request.headers['x-token-id'];

  /** 对于 get 请求，可以通过 query 参数传递 token */
  if (request.method === 'GET') {
    x_token_id = (request.query as any)?.x_token_id;
  }
  if (typeof x_token_id !== 'string') {
    return reply.send(
      superjson.serialize(
        handleError(new MsgError(MsgError.op_toLogin, '请提供有效的 x_token_id')),
      ),
    );
  }
  const { db, user } = await getAuthFromCache(x_token_id);
  //#endregion

  const apisRpc = createRPC('apiProvider', {
    genApiModule: async (/** 这里是为了避免递归解析 prisma 的类型导致 Effect 失效 */) =>
      ({ ...apis, db } as unknown as APIRaw),
  });

  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise(() =>
        apisRpc.RC(method, params).catch((e) => {
          return new MsgError(MsgError.op_msgError, 'api调用失败' + e?.message);
        }),
      );
      if (Effect.isEffect(result)) {
        return yield* result;
      }
      return result;
    }).pipe(Effect.provideService(AuthService, { x_token_id, db, user })),
  );
  return result;
}
/** 不需要登录状态即可访问的接口 */
const appApisRpc = createRPC('apiProvider', { genApiModule: async () => appApis });
async function handleAppApi(method: string, params: any) {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise(() =>
        appApisRpc.RC(method, params).catch((e) => {
          return new MsgError(MsgError.op_msgError, 'api调用失败' + e?.message);
        }),
      );
      if (Effect.isEffect(result)) {
        return yield* result;
      }
      return result;
    }),
  );
  return result;
}

function createAPIHandler(
  pathPrefix: string,
  hander: (method: string, params: any, request: FastifyRequest, reply: FastifyReply) => any,
) {
  return async function apiHandler(request: FastifyRequest, reply: FastifyReply) {
    const startTime = Date.now();
    const method = request.url.split('?')[0]?.slice(pathPrefix.length) ?? '';
    try {
      const contentType = request.headers['content-type'];
      let params;
      if (request.method === 'GET') {
        params = [request.query]; // Assuming query parameters are used for GET requests
      } else if (contentType === 'application/json') {
        params = superjson.deserialize(request.body as SuperJSONResult) as any[];
      } else if (contentType?.startsWith('multipart/form-data')) {
        const file = await request.file();
        const buffer = await file!.toBuffer();
        const fileObject = new File([buffer], file!.filename, { type: file!.mimetype });
        params = [fileObject];
      } else {
        params = [];
        console.log('Unknown content type:', contentType);
      }

      console.log('[params]', params);
      const result = await hander(method, params, request, reply);
      if (result instanceof MsgError) reply.send(superjson.serialize(handleError(result)));
      reply.send(superjson.serialize({ result }));
    } catch (error) {
      reply.send(superjson.serialize(handleError(error)));
    } finally {
      const endTime = Date.now();
      console.log(`call:[${endTime - startTime}ms]`, method);
    }
  };
}
// ========== 服务器初始化 ==========
export async function startServer() {
  const fastify = Fastify({ logger: false });

  // 中间件
  fastify.register(fastifyCors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // 路由
  fastify.all('/api/*', createAPIHandler('/api/', handleApi));
  fastify.all('/app-api/*', createAPIHandler('/app-api/', handleAppApi));
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'frontend'), // 静态文件目录
    prefix: '/', // 访问前缀
  });
  // 处理 SPA 的路由回退
  fastify.setNotFoundHandler((request, reply) => {
    // 如果请求的不是 API 或静态文件，返回 index.html
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
