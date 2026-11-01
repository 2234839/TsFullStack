/**
 * dbWorker 线程协议：主线程 ↔ Worker 的消息类型与错误序列化。
 *
 * 两侧共用，只允许纯类型与纯函数，禁止依赖 Effect / fastify 等主线程模块，
 * 否则 worker bundle 会背上整包依赖。
 */

/** 单次模型操作在 worker 侧的观测记录（cost-logger 插件采集；atMs 为 worker 的 performance.now 时基） */
export interface WorkerSqlEvent {
  model: string;
  operation: string;
  /** 总耗时 ms（含 ORM 校验/建查询包装开销） */
  ms: number;
  /** 驱动层真实执行耗时 ms（语句注释 id 认领） */
  execMs: number;
  /** 语句开始时刻（worker 时基，主线程用 clockOffset 换算） */
  atMs: number;
}

/** 驱动层语句执行记录（快照诊断用；atMs 为 worker 时基） */
export interface WorkerDriverTiming {
  id: number;
  atMs: number;
  ms: number;
  sql: string;
}

/** Error 的可结构化克隆形态：保留 code/meta（P2004/P2025、zod 校验错误的判定全靠这两个字段） */
export interface SerializedError {
  name: string;
  message: string;
  code?: unknown;
  meta?: unknown;
  stack?: string;
}

/** 主线程 → worker 请求 */
export type DbWorkerRequest =
  | { type: 'init'; id: number; databasePath: string }
  | { type: 'clockSync'; id: number; tMs: number }
  | { type: 'call'; id: number; clientId: string; txId?: string; method: string; args: unknown[] }
  | { type: 'createAuthClient'; id: number; user: unknown }
  | { type: 'txBegin'; id: number; clientId: string; timeoutMs: number }
  | { type: 'txEnd'; id: number; txId: string; commit: boolean }
  | { type: 'snapshot'; id: number; fromMs: number; toMs: number };

/** Omit 在联合类型上不分布，需经裸类型参数显式分布（请求体 = 各请求变体去掉 id） */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type DbWorkerRequestBody = DistributiveOmit<DbWorkerRequest, 'id'>;

/** worker → 主线程响应（events 仅供 call 响应附带，供主线程回灌 ReqCtx 诊断） */
export type DbWorkerResponse =
  | { id: number; ok: true; result: unknown; events?: WorkerSqlEvent[] }
  | { id: number; ok: false; error: SerializedError };

/** 把未知错误压平为可克隆纯数据 */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    /** Prisma/ZenStack 错误的 code 与 meta 是普通自有属性，逐一浅取 */
    const rec: Record<string, unknown> = {};
    for (const key of ['code', 'meta'] as const) {
      const v = (error as unknown as Record<string, unknown>)[key];
      if (v !== undefined) rec[key] = v;
    }
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: rec['code'],
      meta: rec['meta'],
    };
  }
  /** 非 Error 抛出值（字符串/对象等）：塞进 message 保真传递 */
  return { name: 'NonError', message: String(error) };
}

/**
 * 还原 Error：isZenStackPermissionError / isRecordNotFoundError 等判定读取
 * code / meta 字段，必须在重建的 Error 上恢复为自有属性。
 */
export function deserializeError(data: SerializedError): Error {
  const error = new Error(data.message);
  Object.defineProperty(error, 'name', { value: data.name });
  if (data.code !== undefined) {
    Object.defineProperty(error, 'code', { value: data.code, enumerable: true, writable: true });
  }
  if (data.meta !== undefined) {
    Object.defineProperty(error, 'meta', { value: data.meta, enumerable: true, writable: true });
  }
  if (data.stack) {
    Object.defineProperty(error, 'stack', { value: data.stack, writable: true });
  }
  return error;
}
