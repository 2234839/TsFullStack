import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { ORMError, ORMErrorReason } from '@zenstackhq/orm';
import { Cause, Effect, Exit, Layer, Queue, Semaphore, Tracer } from 'effect';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import os from 'os';
import path from 'path';
import superjson, { type SuperJSONResult } from 'superjson';
import { fileURLToPath } from 'url';
import { AuthContext } from '../Context/Auth';
import { ReqCtxService, type ReqCtx } from '../Context/ReqCtx';
import { AppConfigService } from '../Context/AppConfig';
import { systemLog } from '../Context/SystemLog';
import { insertDiagTrace, snapshotDriverTimings } from '../Context/DbService';
import { ConfigLive } from '../Context/AppLive';
import { maxLoopLagBetween, lagSamplesBetween, startLoopLagMonitor } from '../util/LoopLagMonitor';
import { buildSpanTree, makeSpanCollector, type SpanCollector } from '../util/EffectSpanCollector';
import { GithubAuthLive } from '../OAuth/github';
import { LinuxDoAuthLive } from '../OAuth/linuxdo';
import { apis, type APIRaw } from '../api';
import { appApis } from '../api/appApi';
import { FileWrapItem } from '../util/file-types';
import { verifySignByToken } from '../lib/SessionAuthSign';
import { createRPC } from '../rpc';
import { MsgError, LogoutError, ToLoginError, fail, tryOrFail, extractErrorMessage } from '../util/error';
import { FetchWithProxy, FetchWithProxyLive } from '../util/github-proxy';
import {
  createDetailedErrorMessage,
  isRecordNotFoundError,
  isZenStackPermissionError,
  isZenStackValidationError,
} from '../util/zenstack-error';
import { getAuthFromCache } from './authCache';
import { pushRecentRequest } from '../api/authApi/diagApi';
import { registerWebhookRoutes } from './webhook';
import { registerGroupEntryRoutes } from './groupEntry';
import { registerWechatRoutes } from './wechat';
import { CORS_MAX_AGE_SECONDS, MAX_UPLOAD_BYTES, SERVER_PORT, SERVER_HOST, MAX_WAIT_MS, MSG } from '../util/constants';

/** 通用 RPC 调用辅助（消除 app-api/api 两分支的重复 tryPromise+isEffect 模式） */
const callRpc = <T>(rpc: ReturnType<typeof createRPC>, method: string, params: unknown[]) =>
  Effect.gen(function* () {
    const res = yield* tryOrFail('RPC 调用', () => rpc.RC(method, params));
    if (Effect.isEffect(res)) return yield* res as Effect.Effect<T>;
    return res as T;
  });

/** ESM 模块中获取 __dirname 的替代方案 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 日志前缀 */
const LOG_PREFIX = '[Server]';

/** 构建时由 vite define 注入的版本信息 */
declare const __GIT_COMMIT__: string;
declare const __BUILD_TIME__: string;

/** 每个 CPU 核心分配的请求并发数 */
const REQUESTS_PER_CPU_CORE = 10;

/** 统一错误序列化函数 */
function handleCause(cause: Cause.Cause<unknown>) {
  let err: { message: string; kind?: string } | undefined;
  function setErr(error: unknown): string {
    if (MsgError.isMsgError(error) || error instanceof LogoutError || error instanceof ToLoginError) {
      /** kind = 错误类 _tag，前端按它分流（logout/toLogin/msgError） */
      err = { message: error.message, kind: error._tag };
    } else if (error instanceof ORMError) {
      /**
       * https://zenstack.dev/docs/orm/access-control/query#setting-auth-user
       * Mutation operations that affect a single, unique row, like update and delete, will throw an ORMError with reason set to NOT_FOUND if the target row doesn't meet the "update" or "delete" policies respectively. See Errors for more details.
       * Why set reason as NOT_FOUND instead of REJECTED_BY_POLICY? Because the rationale is rows that don't satisfy the policies "don't exist".
       */
      if (error.reason === ORMErrorReason.NOT_FOUND) {
        err = { message: MSG.NO_ACCESS_OR_NOT_FOUND };
      } else if (
        /** 检查是否为 Prisma/ZenStack 的 P2004 或 P2025 错误 */
        isZenStackPermissionError(error)
      ) {
        err = { message: MSG.ACCESS_DENIED };
      } else if (isRecordNotFoundError(error)) {
        err = { message: MSG.RECORD_NOT_FOUND };
      } else if (isZenStackValidationError(error)) {
        err = { message: MSG.VALIDATION_FAILED };
      } else {
        // 其他错误，使用第一行错误消息
        err = { message: (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '' };
      }
    } else {
      err = { message: String(error) };
    }
    return String(error);
  }
  /** effect v4：Cause 不再是单 reason 而是 reasons 列表，遍历所有 Fail/Die reason 提取错误信息 */
  for (const reason of cause.reasons) {
    if (reason._tag === 'Fail' || reason._tag === 'Die') {
      setErr(reason._tag === 'Fail' ? reason.error : reason.defect);
    }
  }
  const causeMsg = err ? String((err as { message: string }).message) : '(empty)';

  if (err) {
    return err;
  }
  return { message: causeMsg };
}

/**
 * 判断请求体是否为 superjson 格式
 * superjson 序列化后的结构为 { json: ..., meta?: ... }
 */
function isSuperJsonBody(body: unknown): body is SuperJSONResult {
  return typeof body === 'object' && body !== null && 'json' in body;
}

/** 参数解析函数 */
async function parseParams(req: FastifyRequest): Promise<unknown[]> {
  const contentType = req.headers['content-type'];
  if (contentType?.includes('application/json')) {
    /** 兼容 superjson 和普通 JSON 两种格式 */
    if (isSuperJsonBody(req.body)) {
      const parsed = superjson.deserialize(req.body as SuperJSONResult) as unknown;
      if (!Array.isArray(parsed)) {
        throw MsgError.msg(MSG.PARAM_FORMAT_ERROR);
      }
      return parsed;
    }
    /** 普通 JSON：直接当数组解析 */
    if (Array.isArray(req.body)) {
      return req.body;
    }
    throw MsgError.msg(MSG.PARAM_FORMAT_ERROR);
  } else if (contentType?.startsWith('multipart/form-data')) {
    /** 文件本体走 multipart，其余 RPC 参数通过查询字符串传输；首参数保留 File 占位 */
    const query = req.query as { args?: string };
    if (!query.args) return [];
    const parsed: unknown = superjson.parse(query.args);
    if (!Array.isArray(parsed)) {
      throw MsgError.msg(MSG.PARAM_FORMAT_ERROR);
    }
    return [undefined, ...parsed];
  } else if (req.method === 'GET') {
    const query = req.query as {
      args?: string;
      sign?: string;
      session?: string;
    };
    if (!query.args) return [];
    const parsed = superjson.parse(query.args) as unknown;
    if (!Array.isArray(parsed)) {
      throw MsgError.msg(MSG.PARAM_FORMAT_ERROR);
    }
    return parsed;
  } else {
    throw MsgError.msg(`Unknown content type: ${contentType}`);
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
        return yield* Effect.fail(ToLoginError.msg('请提供有效的 session'));
      }
      const verify = yield* Effect.try({
        try: () => verifySignByToken(query.args ?? '', session.token, query.sign ?? ''),
        catch: (e) => MsgError.msg(`签名验证失败: ${extractErrorMessage(e)}`),
      });
      if (!verify) {
        return yield* fail(MSG.SIGNATURE_INVALID);
      }
    }
    const params = yield* tryOrFail('参数解析', () => parseParams(req));
    return { params, db, user };
  });
}

type ApiCtx = {
  req: FastifyRequest;
  reply: FastifyReply;
  pathPrefix: string;
  onEnd: () => void;
  enqueueTime: number;
  /** 入队时刻（performance.now 单调时基），与驱动计时/tHeaders 同基 */
  enqueuePerf: number;
};

/** 请求网络阶段时间戳（performance.now 单调时基），由 Fastify 生命周期钩子写入 */
type NetPhases = {
  /** 请求到达（onRequest：headers 解析完，body 未读） */
  tHeaders?: number;
  /** 响应开始（onSend：payload 序列化完即将写 socket） */
  tSendStart?: number;
  /** 响应完毕回调（handleReq 预置，onResponse 触发，拿到 tSendDone 后落盘诊断） */
  finalize?: (tSendDone: number, respBytes?: number) => void;
};
const netPhases = new WeakMap<FastifyRequest, NetPhases>();

/** 出站响应字节数（onResponse 时读 content-length，无则 undefined） */
const contentLengthOf = (request: FastifyRequest): number | undefined => {
  const v =
    request.raw.headers['content-length'] ??
    (request as unknown as { reply?: { getHeader?: (k: string) => unknown } }).reply?.getHeader?.('content-length');
  const n = typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

/** rpc 实例，提到外部可避免每次重新创建 */
const appApisRpc = createRPC('apiProvider', { genApiModule: async () => appApis });
let reqId = 0;

/** 慢请求落盘阈值：总耗时 / 单条 SQL / 事件循环卡顿任一超阈值即记录 */
const SLOW_TOTAL_MS = 500;
const SLOW_SQL_MS = 100;
const SLOW_LOOP_LAG_MS = 50;
/** 诊断时间线里 SQL 明细条数上限（防异常请求生成超大 JSON） */
const DIAG_SQL_EVENTS_LIMIT = 50;

/**
 * 请求结束后构建观测数据：全量推入内存环形缓冲（含快请求），超阈值的慢请求额外落盘。
 *
 * 阻塞判定：loopLagMaxMs ≈ sqlMaxMs → 硬阻塞（同步冻结事件循环，
 * better-sqlite3 是同步驱动）；loopLagMaxMs ≈ 0 但总耗时长 → 纯事件等待。
 */
function finalizeDiag(input: {
  reqCtx: ReqCtx;
  method: string;
  enqueueTime: number;
  authMs?: number;
  authAt?: number;
  rpcMs?: number;
  rpcAt?: number;
  startPerf: number;
  endPerf: number;
  totalMs: number;
  error: boolean;
  /** 本请求的 span 采集器（有则落盘 span 树） */
  spanCollector?: SpanCollector;
  /** 入队时刻（performance.now 单调时基），与驱动计时同基，用于 driverSql 窗口与上传耗时 */
  enqueuePerf?: number;
  /** 响应完毕时刻（onResponse 触发，performance.now） */
  tSendDone?: number;
  /** 出站响应字节数（content-length，无则 undefined） */
  respBytes?: number;
}) {
  const {
    reqCtx,
    method,
    enqueueTime,
    authMs,
    authAt,
    rpcMs,
    rpcAt,
    startPerf,
    endPerf,
    totalMs,
    error,
    spanCollector,
    enqueuePerf,
    tSendDone,
    respBytes,
  } = input;
  const sqlEvents = reqCtx.sqlEvents;
  const sqlTotalMs = sqlEvents.reduce((sum, el) => sum + el.ms, 0);
  const sqlMaxMs = sqlEvents.reduce((max, el) => Math.max(max, el.ms), 0);
  const loopLagMaxMs = maxLoopLagBetween(startPerf, endPerf);
  /** 窗口内卡顿样本（at 相对请求起点），供前端在瀑布图上叠加暗红条 */
  const lagSlices = lagSamplesBetween(startPerf, endPerf).map((s) => ({
    at: Math.round(s.at - startPerf),
    ms: Math.round(s.lagMs),
  }));
  const queueWaitMs = enqueuePerf != null ? Math.max(0, startPerf - enqueuePerf) : Math.max(0, startPerf - enqueueTime);

  const timeline: Array<Record<string, unknown>> = [
    { phase: 'queue', ms: Math.round(queueWaitMs), at: 0, note: '请求在处理队列中的等待' },
  ];
  /** 网络阶段：上传（请求到达→入参完毕）、响应传输（onSend→onResponse） */
  const ph = netPhases.get(reqCtx.req);
  const uploadMs =
    enqueuePerf != null && ph?.tHeaders != null ? Math.max(0, Math.round(enqueuePerf - ph.tHeaders)) : undefined;
  const sendMs =
    ph?.tSendStart != null && tSendDone != null ? Math.max(0, Math.round(tSendDone - ph.tSendStart)) : undefined;
  if (uploadMs != null || sendMs != null) {
    timeline.push({ phase: 'net', uploadMs, sendMs, respBytes });
  }
  if (authMs != null)
    timeline.push({
      phase: 'auth',
      ms: Math.round(authMs),
      at: authAt != null ? Math.round(authAt) : null,
      note: '鉴权 getDbAuth（含用户查询 SQL）',
    });
  if (rpcMs != null)
    timeline.push({
      phase: 'rpc',
      ms: Math.round(rpcMs),
      at: rpcAt != null ? Math.round(rpcAt) : null,
      note: 'RPC 业务处理（含其中全部 SQL/出站请求）',
    });
  timeline.push({
    phase: 'sqlEvents',
    count: sqlEvents.length,
    sqlTotalMs,
    sqlMaxMs,
    items: sqlEvents.slice(0, DIAG_SQL_EVENTS_LIMIT),
  });
  /** 驱动层真实执行语句（自描述事件，与 sqlEvents 的差值即 ORM 校验/建查询开销） */
  const driverSql = snapshotDriverTimings(enqueuePerf ?? 0, endPerf).slice(0, DIAG_SQL_EVENTS_LIMIT);
  if (driverSql.length > 0) {
    timeline.push({
      phase: 'driverSql',
      count: driverSql.length,
      execTotalMs: Math.round(driverSql.reduce((s, t) => s + t.ms, 0) * 100) / 100,
      items: driverSql.map((t) => ({
        ms: Math.round(t.ms * 100) / 100,
        at: Math.round(t.atMs - startPerf),
        sql: t.sql.length > 120 ? t.sql.slice(0, 120) + '…' : t.sql,
      })),
    });
  }
  if (spanCollector) {
    const tree = buildSpanTree(spanCollector.spans);
    if (tree.length > 0) timeline.push({ phase: 'spanTree', tree });
  }
  if (error) timeline.push({ phase: 'error', note: '请求以错误结束，总耗时含错误序列化' });
  /** 卡顿归属：卡顿样本落在自身执行区间（auth/rpc span）内 = 自己冻结了事件循环（肇事者）；
  落在间隙 = 自己只是在排队时被别人冻结（受害者，自身耗时很短，无需优化） */
  const ownSpans: Array<[number, number]> = [];
  if (authAt != null && authMs != null) ownSpans.push([authAt, authAt + authMs]);
  if (rpcAt != null && rpcMs != null) ownSpans.push([rpcAt, rpcAt + rpcMs]);
  const lagOverlapsSelf = (lag: { at: number; ms: number }) =>
    ownSpans.some(([s, e]) => lag.at < e && lag.at + lag.ms > s);
  const lagItems = lagSlices.filter((s) => s.ms >= 5);
  if (lagItems.length > 0) {
    /** 最大卡顿样本的归属作为请求级判定 */
    const maxLag = lagItems.reduce((a, b) => (b.ms > a.ms ? b : a));
    timeline.push({
      phase: 'loopLag',
      maxMs: loopLagMaxMs,
      owner: lagOverlapsSelf(maxLag) ? 'self' : 'other',
      items: lagItems.slice(0, DIAG_SQL_EVENTS_LIMIT),
    });
  }

  const lagPhase = timeline.find((t) => t.phase === 'loopLag');
  const lagOwner =
    lagPhase && typeof lagPhase.owner === 'string' && (lagPhase.owner === 'self' || lagPhase.owner === 'other')
      ? lagPhase.owner
      : undefined;
  const row = {
    method,
    totalMs: Math.round(totalMs),
    queueWaitMs: Math.round(queueWaitMs),
    authMs: authMs != null ? Math.round(authMs) : undefined,
    sqlCount: sqlEvents.length,
    sqlTotalMs,
    sqlMaxMs,
    loopLagMaxMs,
    /** 卡顿归属：self=自身同步执行冻结了事件循环；other=排队期间被他人冻结（受害者） */
    lagOwner: lagPhase?.owner,
    timeline,
  };

  /** 全量推入内存环形缓冲（实时请求流，含快请求） */
  pushRecentRequest({
    method: row.method,
    totalMs: row.totalMs,
    queueWaitMs: row.queueWaitMs,
    authMs: row.authMs,
    sqlCount: row.sqlCount,
    sqlTotalMs: row.sqlTotalMs,
    sqlMaxMs: row.sqlMaxMs,
    loopLagMaxMs: row.loopLagMaxMs,
    lagOwner: row.lagOwner,
    error,
    timeline,
  });

  const isSlow = totalMs >= SLOW_TOTAL_MS || sqlMaxMs >= SLOW_SQL_MS || loopLagMaxMs >= SLOW_LOOP_LAG_MS;
  if (!isSlow) return;

  const note = `阻塞判定: ${loopLagMaxMs >= SLOW_LOOP_LAG_MS ? `硬阻塞(lag=${loopLagMaxMs}ms${sqlMaxMs >= SLOW_SQL_MS ? ` ≈ sqlMax=${sqlMaxMs}ms，疑似同步 SQL/序列化冻结进程` : ''})` : '事件等待(lag≈0，耗时在外部 IO/等待)'} | 慢点: ${timeline.map((t) => `${t.phase}=${(t as { ms?: number }).ms ?? '-'}ms`).join(' ')}`;
  reqCtx.log('[diag]', note);

  /** fire-and-forget：落盘不阻塞响应，ConfigLive 提供 AppConfigService（DbClientEffect 依赖） */
  Effect.runFork(Effect.provide(insertDiagTrace(row), ConfigLive));
}

/** 注意，这里必须要等待发送数据完毕，否则 onEnd 之后数据将无法发送 */
function handleReq({ req, reply, pathPrefix, enqueueTime, enqueuePerf, onEnd }: ApiCtx) {
  const startTime = Date.now();
  const startPerf = performance.now();
  const diag: { t0: number; authMs?: number; authAt?: number; rpcMs?: number; rpcAt?: number } = { t0: startPerf };
  /** 请求级 span 采集器：把 Effect Tracer 采集的 span 树落盘到诊断记录 */
  const spanCollector = makeSpanCollector();
  const reqCtx: ReqCtx = {
    logs: [],
    log(...args) {
      reqCtx.logs.push(args);
    },
    req,
    reqId: ++reqId,
    t0: startPerf,
    sqlEvents: [],
    spanCollector,
  };
  let method: string;
  try {
    method = decodeURIComponent(req.url.split('?')[0]?.slice(pathPrefix.length) ?? '');
  } catch {
    reply.code(400).send({ error: 'Malformed URL encoding' });
    onEnd();
    return Effect.void;
  }

  const program = buildReqProgram({ req, reply, pathPrefix, method, enqueueTime, diag });

  /** 合成层，避免其他 service 还在依赖 FetchWithProxy */
  const unFetchProxyLayer = Layer.provide(GithubAuthLive, FetchWithProxyLive);
  const unLinuxDoLayer = Layer.provide(LinuxDoAuthLive, FetchWithProxyLive);
  const allOAuthLayers = Layer.merge(unFetchProxyLayer, unLinuxDoLayer);

  const reqLayer = Layer.succeed(ReqCtxService, reqCtx);
  /** 合成层，避免其他 service 还在依赖 ReqCtxService  */
  const unReqLayer = Layer.provide(allOAuthLayers, reqLayer);

  const apiLayer = unReqLayer;
  const runnable = Effect.provide(Effect.withSpan(program, method), [
    apiLayer,
    /**
    Q:为什么这里还要传递 reqLayer，前面已经传递了 unReqLayer (apiLayer) 啊？
    A:要注意 unReqLayer 解决的是 unReqLayer 这个声明中的层依赖 ReqCtxService 的问题，但是并没有给 program 提供 ReqCtxService，所以这里主要就是给 program 提供
      理论上就可以不要使用 unReqLayer 了,但为了代码逻辑清晰还是使用 unReqLayer
    */ reqLayer,
    Layer.succeed(Tracer.Tracer, spanCollector.tracer),
  ]);

  /** 拦截并处理所有错误 */
  return Effect.gen(function* () {
    let failed = false;
    const exit = yield* Effect.exit(runnable);
    if (Exit.isFailure(exit)) {
      failed = true;
      const cause = exit.cause;

      /** 记录详细的错误信息 */
      if (cause.reasons.some((r) => r._tag === 'Die')) {
        const defect: unknown = cause.reasons.find((r) => r._tag === 'Die')?.defect;
        const defectStack =
          defect instanceof Error ? defect.stack?.split('at Generator.next (<anonymous>)')?.[0] : String(defect);
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
    const endPerf = performance.now();
    /** 诊断落盘延迟到 onResponse（响应发完）：拿到响应传输耗时后一次性归档 */
    const finalize = (tSendDone: number, respBytes?: number) =>
      finalizeDiag({
        reqCtx,
        method,
        enqueueTime,
        enqueuePerf,
        authMs: diag.authMs,
        authAt: diag.authAt,
        rpcMs: diag.rpcMs,
        rpcAt: diag.rpcAt,
        startPerf,
        endPerf,
        totalMs: endTime - startTime,
        error: failed,
        spanCollector,
        tSendDone,
        respBytes,
      });
    const ph = netPhases.get(req);
    if (ph) ph.finalize = finalize;
    else finalize(endPerf);
    return yield* systemLog({ level: 'info', message: `${endTime - startTime}ms ${method}` }, reqCtx);
  });
}

/** 构建请求核心业务逻辑 Effect（等待检查 → 路由分发 → RPC 调用 → 响应序列化） */
function buildReqProgram(opts: {
  req: FastifyRequest;
  reply: FastifyReply;
  pathPrefix: string;
  method: string;
  enqueueTime: number;
  /** 诊断阶段耗时收集器（handleReq 创建，落盘时读取；t0 为相对时基，at = performance.now() - t0） */
  diag: { t0: number; authMs?: number; authAt?: number; rpcMs?: number; rpcAt?: number };
}) {
  return Effect.gen(function* () {
    const waitTime = Date.now() - opts.enqueueTime;
    if (waitTime > MAX_WAIT_MS) {
      return yield* fail(MSG.SERVER_BUSY);
    }

    let result: unknown;
    if (opts.pathPrefix === '/app-api/') {
      const params = yield* tryOrFail('参数解析', () => parseParams(opts.req));
      const rpcStart = performance.now();
      result = yield* Effect.withSpan(callRpc(appApisRpc, opts.method, params), `rpc:${opts.method}`);
      opts.diag.rpcMs = performance.now() - rpcStart;
      opts.diag.rpcAt = rpcStart - opts.diag.t0;
    } else if (opts.pathPrefix === '/api/') {
      /** 处理需要鉴权的 API */
      const authStart = performance.now();
      const { params, db, user } = yield* Effect.withSpan(parseParamsAndAuth(opts.req), 'auth:鉴权(含用户查询SQL)');
      opts.diag.authMs = performance.now() - authStart;
      opts.diag.authAt = authStart - opts.diag.t0;
      const rpcStart = performance.now();
      const apisRpc = createRPC('apiProvider', {
        /** apis + db → APIRaw: 动态合并的模块对象无法在编译期精确匹配 APIRaw 接口，运行时结构一致 */
        genApiModule: async () => ({ ...apis, db }) as unknown as APIRaw,
      });
      result = yield* Effect.withSpan(
        callRpc(apisRpc, opts.method, params)
          // 提供 apis 模块所需要的依赖
          .pipe(Effect.provideService(AuthContext, { db, user })),
        `rpc:${opts.method}`,
      );
      opts.diag.rpcMs = performance.now() - rpcStart;
      opts.diag.rpcAt = rpcStart - opts.diag.t0;
    }
    if (result instanceof FileWrapItem) {
      yield* sendFileResponse(opts.reply, result);
    } else {
      yield* Effect.promise(async () => opts.reply.send(superjson.serialize({ result })));
    }
  });
}

/** 发送文件流式响应（支持 HTTP Range 请求） */
function sendFileResponse(reply: FastifyReply, fileItem: FileWrapItem) {
  return Effect.gen(function* () {
    const fileSize = fileItem.model.size;
    const rangeHeader = reply.request.headers['range'];

    // 设置公共文件响应头
    reply
      .type(fileItem.model.mimetype ?? 'application/octet-stream')
      .header('Accept-Ranges', 'bytes')
      .header(
        'Content-Disposition',
        /** filename 已在 FilePathService.sanitizeFilename 中移除 " \r \n 等危险字符，此处仅编码防止头部注入 */
        `inline; filename="${encodeURIComponent(fileItem.model.filename ?? 'file')}"`,
      );

    // 支持 HTTP Range requests（视频分段加载、断点续传）
    if (rangeHeader) {
      const rangeStr =
        typeof rangeHeader === 'string'
          ? rangeHeader
          : Array.isArray(rangeHeader)
            ? rangeHeader[0]
            : String(rangeHeader);
      const parts = rangeStr.replace(/bytes=/, '').split('-');
      const start = Math.max(0, parseInt(parts[0] ?? '0', 10) || 0);
      const rawEnd = parseInt(parts[1] ?? '', 10);
      const end = Math.min(Number.isNaN(rawEnd) ? fileSize - 1 : rawEnd, fileSize - 1);

      if (start >= fileSize || end < start) {
        reply.code(416).header('Content-Range', `bytes */${fileSize}`).send();
        return;
      }

      const chunkSize = end - start + 1;

      reply.code(206).header('Content-Range', `bytes ${start}-${end}/${fileSize}`).header('Content-Length', chunkSize);
      yield* Effect.promise(async () => reply.send(fileItem.getFileStreamRange(start, end)));
    } else {
      reply.header('Content-Length', fileSize);
      yield* Effect.promise(async () => reply.send(fileItem.getFileStream()));
    }
  });
}
/** 服务器初始化 */
export const startServer = Effect.gen(function* () {
  const fastify = Fastify({ logger: false, bodyLimit: 10 * 1024 * 1024 }); // 10MB JSON body limit
  const appConfig = yield* AppConfigService;

  //#region fastify 注册中间件:cors Multipart static
  /** CORS origin 配置：优先使用配置白名单，未配置或空数组则允许所有来源 */
  const corsOrigin = appConfig.corsOrigins && appConfig.corsOrigins.length > 0 ? appConfig.corsOrigins : true; // true 等效于 '*'
  if (corsOrigin === true && process.env.NODE_ENV === 'production') {
    console.warn('[Server] CORS 允许所有来源(*)，建议在 config.json 中配置 corsOrigins 白名单');
  }
  fastify.register(fastifyCors, {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-token-id'],
    exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
    credentials: false,
    maxAge: CORS_MAX_AGE_SECONDS, // 预检请求结果缓存24小时
  });
  fastify.register(fastifyMultipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES }, // 1GB
  });
  console.log(`${LOG_PREFIX} static files:`, path.join(__dirname, 'frontend'));
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'frontend'),
    prefix: '/',
  });

  /**
   * 全局安全响应头（最小权限，不影响现有功能）：
   * - X-Content-Type-Options: 阻止 MIME 嗅探（上传的 HTML/SVG 被当页面执行是存储型 XSS 主通道）
   * - X-Frame-Options / frame-ancestors: 默认仅允许同源嵌入；NoteCalc 页面允许跨域嵌入
   * - Referrer-Policy: URL query 可能携带签名参数，避免外泄给第三方
   * - CSP: script-src 仅同源（防注入外链脚本）；img/media 允许外部源（头像 ui-avatars.com、
   *   AI 生图 pollinations.ai 等业务依赖）；connect-src 允许任意 https（用户可自定义 OpenAI 兼容端点）
   */
  fastify.addHook('onRequest', async (request) => {
    netPhases.set(request, { tHeaders: performance.now() });
  });

  fastify.addHook('onSend', async (request, reply) => {
    const ph = netPhases.get(request);
    if (ph) ph.tSendStart = performance.now();
    const pathname = new URL(request.url, 'http://localhost').pathname.replace(/\/+$/, '');
    const allowCrossOriginFrame = pathname === '/noteCalc' || pathname === '/noteCalc/embed';

    reply.header('X-Content-Type-Options', 'nosniff');
    if (!allowCrossOriginFrame) {
      reply.header('X-Frame-Options', 'SAMEORIGIN');
    }
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "media-src 'self' blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
        "frame-src 'self'",
        `frame-ancestors ${allowCrossOriginFrame ? '*' : "'self'"}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    );
  });
  /** 响应发完才落盘诊断：拿到响应完毕时刻与出站字节，避免响应未完成就归档 */
  fastify.addHook('onResponse', async (request) => {
    netPhases.get(request)?.finalize?.(performance.now(), contentLengthOf(request));
  });

  //#endregion

  /** 创建一个无界队列 */
  const queue = yield* Queue.unbounded<ApiCtx>();

  /**
   * 解决 Effect 的异步边界问题：创建一个普通的回调函数来将数据传递给外层的 Effect 程序，然后外层程序通过消费队列来处理数据。
   * emitReq 将请求放入队列，返回 Promise 以支持 await。
   */
  const emitReq = (ctx: ApiCtx) => Effect.runPromise(Queue.offer(queue, ctx));

  /**
   * onEnd 是为了解决 fastify 的回调函数执行完毕后，fastify 会自动结束请求，而我们希望在 Effect Stream 中处理请求，所以需要维持时机到处理完毕。
   * 这个 onEnd 实现的比较丑陋，但是没想到什么好方法解决这个问题。
   */
  function registerRoute(pathPrefix: string) {
    return async function (req: FastifyRequest, reply: FastifyReply) {
      let resolved = false;
      const p = new Promise<void>((resolve) => {
        /** 包装 resolve，防止多次调用 onEnd */
        const onceResolve = () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };
        /** 将请求上下文放入队列 */
        emitReq({
          req,
          reply,
          pathPrefix,
          enqueueTime: Date.now(),
          enqueuePerf: performance.now(),
          onEnd: onceResolve,
        });
      });
      await p;
    };
  }

  fastify.all('/api/*', registerRoute('/api/'));
  fastify.all('/app-api/*', registerRoute('/app-api/'));

  /** 版本信息端点（无需认证，用于验证线上部署版本） */
  fastify.get('/version', () => ({
    commit: typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : 'unknown',
    buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'unknown',
  }));

  /** 注册支付 Webhook 回调路由（不走 RPC 系统，由第三方平台直接调用） */
  registerWebhookRoutes(fastify, appConfig);

  /** 注册私域引流路由（微信群动态入口：/group/:entry(.png) + /group/admin/*） */
  registerGroupEntryRoutes(fastify, appConfig);

  /** 注册微信公众号消息路由（GET/POST /wechat，未配置 config.wechat 时不注册） */
  registerWechatRoutes(fastify, appConfig);

  /** 处理 SPA 路由回退 */
  fastify.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/api') && !request.url.startsWith('/app-api')) {
      reply.sendFile('index.html');
    } else {
      reply.code(404).send({ error: 'Not Found' });
    }
  });

  //#region 启动服务器
  const address = yield* tryOrFail('服务器启动', () => fastify.listen({ port: SERVER_PORT, host: SERVER_HOST }));
  console.log(`${LOG_PREFIX} listening on ${address}`);
  /** 启动事件循环卡顿采样（慢请求诊断的硬阻塞判据） */
  startLoopLagMonitor();
  //#endregion

  /** 创建控制最大并发数的信号量 */
  const cpuCount = os.cpus().length;
  const recommendedConcurrency = cpuCount * REQUESTS_PER_CPU_CORE;
  console.log(`${LOG_PREFIX} 请求并发上限: ${recommendedConcurrency}`);

  const semaphore = yield* Semaphore.make(recommendedConcurrency);

  /** 请求队列消费循环 */
  while (true) {
    const ctx = yield* Queue.take(queue);

    /** fork 一个 Fiber 去执行请求处理，确保不会阻塞循环 */
    yield* Effect.forkDetach(
      semaphore.withPermits(1)(
        handleReq(ctx).pipe(
          Effect.catch((err: unknown) =>
            Effect.gen(function* () {
              yield* Effect.logError(`[handleReq error] ${String(err)}`);
              /** 确保客户端收到响应，避免连接挂起 */
              if (!ctx.reply.sent) {
                ctx.reply.code(500).send({ error: 'Internal Server Error' });
              }
            }),
          ),
          Effect.ensuring(Effect.sync(ctx.onEnd)),
        ),
      ),
    );
  }
});
