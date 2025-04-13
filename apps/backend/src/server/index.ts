import { Effect } from 'effect';
import Fastify from 'fastify';
import { Readable } from 'stream';
import { apis, type API } from '../api';
import { createRPC } from '../rpc';
import fastifyCors from '@fastify/cors';

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

export const startServer = async () => {
  fastify.all('/api/*', async (request, reply) => {
    const method = request.url;
    const params = request.body as Array<any>;

    const startTime = Date.now();
    const p = Effect.gen(function* () {
      const result = yield* Effect.tryPromise(() =>
        serverRPC.RC(method.slice(/** 移除 '/api/'  */ 5), params),
      );
      const endTime = Date.now();
      console.log(`call:[${endTime - startTime}ms]`, method, request.body);
      if (Effect.isEffect(result)) {
        const res = yield* result;
        return res;
      } else {
        return result;
      }
    });
    const result = await Effect.runPromise(p);
    reply.send({ result });
  });
  const serverRPC = await createRPC('apiProvider', {
    genApiModule: async () => {
      return apis;
    },
  });

  try {
    const listening = await fastify.listen({ port: 5209, host: '0.0.0.0' });
    console.log(`Server listening on ${listening} ^-^`);
  } catch (err) {
    console.log('[err]', err);
  }
};
