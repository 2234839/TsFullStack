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

    const p = Effect.gen(function* () {
      console.log('call:', method, request.body);
      const result = yield* Effect.tryPromise(() => serverRPC.RC(method.slice(5), params));
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
    console.log(`Server listening on ${listening}`);
    const r = await client.API.a.b(2);
    console.log('[r2]', r);
  } catch (err) {
    console.log('[err]', err);
  }
};

const client = await createRPC<API>('apiConsumer', {
  remoteCall(method, data) {
    let body: ReadableStream | string;
    // 如果第一参数是 ReadableStream 的时候，直接使用 ReadableStream 作为 body，不用考虑其他参数，因为这种情况只支持一个参数
    let content_type;
    if (data[0] instanceof ReadableStream) {
      body = data[0];
      content_type = 'application/octet-stream';
    } else {
      body = JSON.stringify(data);
      content_type = 'application/json';
    }
    return fetch(`http://localhost:5209/api/${method}`, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': content_type,
      },
      // @ts-expect-error 在 node 运行的时候需要声明双工模式才能正确发送 ReadableStream，TODO 需要验证浏览器端可以这样运行吗
      duplex: 'half', // 关键：显式声明半双工模式
    })
      .then((res) => res.json())
      .then((r) => {
        if (r.error) {
          console.log('[r]', r);
          throw new Error();
        }
        return r.result;
      });
  },
});
