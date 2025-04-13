import { Effect } from 'effect';
import Fastify from 'fastify';
import { Readable } from 'stream';
import { apis } from '../api';
import { createRPC } from '../rpc';

const start = async () => {
  const serverRPC = await createRPC('apiProvider', {
    genApiModule: async () => {
      return apis;
    },
  });

  const p = Effect.gen(function* () {
    const result = yield* Effect.tryPromise(() => {
      return serverRPC.RC('a.b', [3]);
    });
    if (Effect.isEffect(result)) {
      const res = yield* result;
      console.log('[res]', res);
    } else {
      result;
    }
  });
  Effect.runPromise(p);
  return;
  try {
    const listening = await fastify.listen({ port: 5209, host: '0.0.0.0' });
    console.log(`Server listening on ${listening}`);
  } catch (err) {
    console.log('[err]', err);
  }
};
const fastify = Fastify({
  logger: false,
});
// fastify.register(fastifyCors, {
//   origin: '*', // 允许所有来源
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // 允许的 HTTP 方法
// });

/** 对于 application/octet-stream 类型的请求转换为 web 兼容的 ReadableStream 供接口处理 */
fastify.addContentTypeParser('application/octet-stream', async function (request, payload, done) {
  const webStream = Readable.toWeb(payload);
  return webStream;
});
// fastify.all('/api/*', async (request, reply) => {
//   const method = request.url;
//   const params = JSON.parse(request.body as string);
//   const result = await serverRPC.RC(method.slice(5), params);
//   reply.send({ result });
// });

start();
