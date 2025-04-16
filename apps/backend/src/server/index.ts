import fastifyCors from '@fastify/cors';
import { Effect, Either, Logger } from 'effect';
import Fastify from 'fastify';
import { Readable } from 'stream';
import { apis, type API } from '../api';
import { appApis } from '../api/appApi';
import { createRPC } from '../rpc';
import { AuthService } from '../service';
import { UnknownException } from 'effect/Cause';
import { PrismaClientKnownRequestError } from '../../prisma/client/runtime/library';
import superjson from 'superjson';
import { getPrisma } from '../db';

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
    const params = request.body as any;

    const x_token_id = request.headers['x-token-id'];
    if (typeof x_token_id !== 'string') {
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }
    const { db, user } = await getPrisma({ x_token_id }).catch((e) => {
      console.log('[e]', e);
      throw e;
    });

    const serverApiRPC = createRPC('apiProvider', {
      genApiModule: async () => {
        return {
          ...apis,
          /** 这里是为了防止 Effct 的类型体统提示循环引用报错 */
          db: db as unknown as undefined,
        };
      },
    });

    function callServerApi(method: string, params: any[]) {
      const startTime = Date.now();
      return Effect.gen(function* () {
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
    const program = callServerApi(method.slice('/api/'.length), superjson.deserialize(params));
    const res = await Effect.runPromise(
      errorHandel(program).pipe(
        Effect.provide(layer),
        Effect.provideService(AuthService, {
          x_token_id,
          db,
          user,
        }),
      ),
    );

    reply.send(superjson.serialize(res));
  });
  fastify.all('/app-api/*', async (request, reply) => {
    const method = request.url;
    const params = request.body as any;

    const program = callAppApi(method.slice('/app-api/'.length), superjson.deserialize(params));

    const res = await Effect.runPromise(errorHandel(program).pipe(Effect.provide(layer))).catch(
      (e) => {
        console.log('[e]', e);
      },
    );

    reply.send(superjson.serialize(res));
  });
  try {
    const listening = await fastify.listen({ port: 5209, host: '0.0.0.0' });
    console.log(`Server listening on ${listening} ^-^`);
  } catch (err) {
    console.log('[err]', err);
  }
};

function errorHandel<A, E, R>(program: Effect.Effect<A, E, R>) {
  return Effect.gen(function* () {
    const failureOrSuccess = yield* Effect.either(program);
    if (Either.isLeft(failureOrSuccess)) {
      const error = failureOrSuccess.left;

      if (typeof error === 'string') {
        return { error: { message: error } };
      }
      if (error instanceof UnknownException) {
        const targetErr = error.error;

        if (targetErr instanceof Error && targetErr.name === 'PrismaClientKnownRequestError') {
          const err = targetErr as PrismaClientKnownRequestError;
          if (err?.meta && 'reason' in err.meta) {
            if (err.meta?.reason === 'ACCESS_POLICY_VIOLATION') {
              return { error: { message: '权限不足' } };
            }
            yield* Effect.log('未定义处理错误', targetErr);

            return { error: { message: err.meta.reason } };
          }
          console.log('数据模型调用错误', targetErr);
          return { error: { message: '数据模型调用错误' } };
        }
      }
      yield* Effect.log(error);
      if (error instanceof Error) {
        return { error };
      }
      return Effect.fail('错误的 fail 值');
    } else {
      return { result: failureOrSuccess.right };
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
