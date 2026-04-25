import type { Effect, API as __API__, AppAPI as __AppAPI__, JsonValue } from '@tsfullstack/backend';

/**
 * 安全地将 JSON.stringify 的结果包装为 JsonValue 类型
 *
 * JSON.stringify 返回 string，而 ZenStack 的 Json 字段类型为 JsonValue（递归联合类型）。
 * 虽然 string 是 JsonValue 的合法子集，但 TS 无法自动推导递归类型的子类型关系。
 */
export function toJsonValue(value: string): JsonValue {
  return value as unknown as JsonValue;
}

/** 解开 Effect 成功类型（在前端本地定义，避免跨 .d.mts 实例化失败） */
type UnEffect<T> = T extends Effect.Effect<infer A, infer _E, infer _R> ? A : T;

/** 不再递归映射的基础类型（截断递归，避免 TS2589 类型实例化过深） */
type LeafTypes = Date | Uint8Array | bigint | JsonValue;

/** 递归映射 API 类型：解开 Effect → Promise，遇到 LeafTypes 截断 */
export type AsyncAPI<T> = T extends LeafTypes
  ? T
  : T extends (...args: infer A) => infer R
  ? (...args: A) => Promise<UnEffect<Awaited<R>>>
  : T extends object
  ? { [K in keyof T]: AsyncAPI<T[K]> }
  : T;

/** 前端可用的完整 API 类型（解开 Effect → Promise） */
type FrontendAPI = AsyncAPI<__API__>;

/** 前端可用的完整 AppAPI 类型 */
type FrontendAppAPI = AsyncAPI<__AppAPI__>;

// ========== 通用 API 类型推导辅助工具 ==========

/** 从 API 方法推导异步返回值类型 */
type ApiReturnType<T> = T extends (...args: any[]) => any ? Awaited<ReturnType<T>> : never;

/** 从数组类型推导元素类型 */
type ArrayElement<T> = T extends (infer E)[] ? E : never;

// ========== 具体类型导出 ==========

/** login API 响应类型 */
export type loginByEmailPwd_res = ApiReturnType<FrontendAppAPI['system']['loginByEmailPwd']>;

/** 数据库模型名称 */
type DbModelName = keyof FrontendAPI['db'];

/**
 * 从 db Model 的 findMany 返回推导列表元素类型
 *
 * 注意: 对于包含 Json 字段的复杂模型，TypeScript 可能因递归类型实例化过深
 * 而报 TS2589。此时应在使用处定义专门的类型，而非依赖 DbListItem。
 *
 * @example
 * type PackageItem = DbListItem<'tokenPackage'>;
 * type TokenItem = DbListItem<'token'>;
 */
export type DbListItem<M extends DbModelName> =
  FrontendAPI['db'][M] extends { findMany: (...args: any[]) => Promise<(infer E)[]> }
    ? E
    : FrontendAPI['db'][M] extends { findMany: (...args: any[]) => any }
    ? ArrayElement<Awaited<ReturnType<FrontendAPI['db'][M]['findMany']>>>
    : never;

/**
 * 从 paymentApi 方法推导返回类型
 *
 * @example
 * type OrderItem = PaymentApiResult<'adminListOrders'>;
 */
export type PaymentApiResult<M extends keyof FrontendAPI['paymentApi']> =
  ApiReturnType<FrontendAPI['paymentApi'][M]>;
