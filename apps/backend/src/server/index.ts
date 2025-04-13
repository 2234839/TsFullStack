import { Effect, Logger } from 'effect';
import Fastify from 'fastify';
import { Readable } from 'stream';
import { apis, type API } from '../api';
import { createRPC } from '../rpc';
import fastifyCors from '@fastify/cors';
import { AuthService } from '../service';
import { appApis } from '../api/appApi';

const fastify = Fastify({
  logger: false,
});
fastify.register(fastifyCors, {
  origin: '*', // 允许所有来源
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // 允许的 HTTP 方法
});

/** 对于 application/octet-stream 类型的请求转换为 web 兼容的 ReadableStream 供接口处理 */
fastify.addContentTypeParser('application/octet-stream', async function (request, payload, done) {
  const webStream = Readable.toWeb(payload);
  return webStream;
});

//#region 自定义日志打印
const logger = Logger.make(({ logLevel, message }) => {
  globalThis.console.log(`[${logLevel.label}]`, ...(Array.isArray(message) ? message : [message]));
});
const layer = Logger.replace(Logger.defaultLogger, logger);
//#endregion 自定义日志打印

export const startServer = async () => {
  fastify.all('/api/*', async (request, reply) => {
    const method = request.url;
    const params = request.body as Array<any>;

    const x_token_id = request.headers['x-token-id'];
    if (typeof x_token_id !== 'string') {
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }

    const program = callServerApi(method.slice('/api/'.length), params);
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(layer),
        Effect.provideService(AuthService, {
          x_token_id,
        }),
      ),
    );

    reply.send(result);
  });
  fastify.all('/app-api/*', async (request, reply) => {
    const method = request.url;
    const params = request.body as Array<any>;

    const program = callAppApi(method.slice('/app-api/'.length), params);
    const result = await Effect.runPromise(program.pipe(Effect.provide(layer)));

    reply.send(result);
  });
  try {
    const listening = await fastify.listen({ port: 5209, host: '0.0.0.0' });
    console.log(`Server listening on ${listening} ^-^`);
  } catch (err) {
    console.log('[err]', err);
  }
};

const serverApiRPC = createRPC('apiProvider', {
  genApiModule: async () => {
    return apis;
  },
});

function callServerApi(method: string, params: any[]) {
  const startTime = Date.now();
  return Effect.gen(function* () {
    const authInfo = yield* AuthService;
    yield* Effect.log('[authInfo]', authInfo);
    const result = yield* Effect.tryPromise(() => serverApiRPC.RC(method, params));
    const endTime = Date.now();

    yield* Effect.log(`call:[${endTime - startTime}ms]`, method, params);

    if (Effect.isEffect(result)) {
      const res = yield* result;
      return res;
    } else {
      return result;
    }
  });
}

const appApiRPC = createRPC('apiProvider', {
  genApiModule: async () => {
    return appApis;
  },
});

function callAppApi(method: string, params: any[]) {
  const startTime = Date.now();
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise(() => appApiRPC.RC(method, params));
    const endTime = Date.now();

    yield* Effect.log(`call:[${endTime - startTime}ms]`, method, params);

    if (Effect.isEffect(result)) {
      const res = yield* result;
      return res;
    } else {
      return result;
    }
  });
}
