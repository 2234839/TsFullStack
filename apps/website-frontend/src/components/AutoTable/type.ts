import type { API } from '../../api';
import type { InjectionKey } from 'vue';
import type { ModelMeta } from '@tsfullstack/backend';
export { ModelMeta } from '@tsfullstack/backend';

/**
 * ZenStack v3 基础参数类型（从后端导入）
 * 用于 AutoTable CRUD 接口的类型约束
 * 注意：这些类型需要泛型参数 <Schema, Model>，但在 AutoTable 的动态场景中
 * 我们在编译时无法确定具体模型，所以使用 any 作为通配符
 */
import type {
  FindManyArgs,
  FindUniqueArgs,
  FindFirstArgs,
  CreateArgs,
  CreateManyArgs,
  CreateManyAndReturnArgs,
  UpdateArgs,
  UpdateManyArgs,
  UpdateManyAndReturnArgs,
  UpsertArgs,
  DeleteArgs,
  DeleteManyArgs,
  CountArgs,
  AggregateArgs,
  GroupByArgs,
} from '@tsfullstack/backend';

/**
 * AutoTable 使用的动态 CRUD 参数类型
 *
 * 对于 AutoTable 这种动态模型的场景，我们在编译时无法确定具体的模型类型。
 * 这里的类型定义只是为了提供基本的代码提示和文档说明。
 *
 * 对于具体的静态类型需求，应该直接使用从后端生成的具体模型类型，例如：
 * - import type { UserFindManyArgs } from '@tsfullstack/backend'
 * - import type { FileCreateArgs } from '@tsfullstack/backend'
 */
export type FindManyArgsDynamic = FindManyArgs<any, any>;
export type FindUniqueArgsDynamic = FindUniqueArgs<any, any>;
export type FindFirstArgsDynamic = FindFirstArgs<any, any>;
export type CreateArgsDynamic = CreateArgs<any, any>;
export type CreateManyArgsDynamic = CreateManyArgs<any, any>;
export type CreateManyAndReturnArgsDynamic = CreateManyAndReturnArgs<any, any>;
export type UpdateArgsDynamic = UpdateArgs<any, any>;
export type UpdateManyArgsDynamic = UpdateManyArgs<any, any>;
export type UpdateManyAndReturnArgsDynamic = UpdateManyAndReturnArgs<any, any>;
export type UpsertArgsDynamic = UpsertArgs<any, any>;
export type DeleteArgsDynamic = DeleteArgs<any, any>;
export type DeleteManyArgsDynamic = DeleteManyArgs<any, any>;
export type CountArgsDynamic = CountArgs<any, any>;
export type AggregateArgsDynamic = AggregateArgs<any, any>;
export type GroupByArgsDynamic = GroupByArgs<any, any>;

/**
 * 从后端 API 获取的模型元数据类型
 */
export type DBModelMeta = Awaited<ReturnType<typeof API.system.getModelMeta>>;

/**
 * API.db 使用的模型名称（从 API 类型推断）
 * ZenStack v3 客户端使用小写形式访问模型
 */
export type DBModelNames = keyof (typeof API)['db'];

/**
 * 模型元数据中的模型键（PascalCase，与 schema 定义一致）
 */
export type ModelMetaNames = keyof DBModelMeta['models'];

/**
 * 从 DBModelMeta 中提取字段类型
 * @example DBFields<'Role'> 得到 Role 模型的字段类型
 */
export type DBFields<M extends ModelMetaNames> = DBModelMeta['models'][M]['fields'];

/**
 * ZenStack v3 字段类型（完整的类型列表）
 * 基于 ZenStack schema 支持的所有类型
 */
export type ZenStackFieldType =
  | 'String'
  | 'Int'
  | 'DateTime'
  | 'Boolean'
  | 'Float'
  | 'Decimal'
  | 'BigInt'
  | 'Json'
  | 'Byte'
  | 'Bytes'
  | string;

/**
 * ZenStack v3 字段信息的扩展类型
 * 直接使用 ZenStack 生成的字段类型
 */
export type FieldInfo = Values<DBModelMeta['models'][ModelMetaNames]['fields']>;

/**
 * 字段的关系信息类型（从 ZenStack FieldDef 中提取）
 */
export type FieldRelation = FieldInfo extends { relation?: infer R } ? R : never;

/** 辅助类型：获取对象所有值的联合类型 */
type Values<T> = T[keyof T];

/**
 * 模型元数据中模型的字段类型（用于前端组件）
 */
export type Fields = DBModelMeta['models'][ModelMetaNames]['fields'];
export type Model = DBModelMeta['models'][ModelMetaNames];

export const injectModelMetaKey = Symbol('injectModelMetaKey') as InjectionKey<ModelMeta>;

/**
 * 判断字段是否为 ID 字段
 */
export function isIdField(field: FieldInfo): field is FieldInfo & { id: true } {
  const f = field as Record<string, unknown>;
  return typeof f.id === 'boolean' && f.id === true;
}

/**
 * 判断字段是否为数组
 */
export function isArrayField(field: FieldInfo): field is FieldInfo & { array: true } {
  const f = field as Record<string, unknown>;
  return typeof f.array === 'boolean' && f.array === true;
}

/**
 * 判断字段是否为数据模型（关系字段）
 */
export function isDataModelField(field: FieldInfo): field is FieldInfo & { relation: Record<string, unknown> } {
  const f = field as Record<string, unknown>;
  return typeof f.relation === 'object' && f.relation !== null;
}

/**
 * 判断字段是否可选
 */
export function isOptionalField(field: FieldInfo): field is FieldInfo & { optional: true } {
  const f = field as Record<string, unknown>;
  return typeof f.optional === 'boolean' && f.optional === true;
}

/**
 * 判断字段是否有默认值
 */
export function hasDefaultField(field: FieldInfo): boolean {
  const f = field as Record<string, unknown>;
  return 'default' in f && f.default !== undefined;
}

/**
 * 判断字段是否为 updatedAt 字段
 */
export function isUpdatedAtField(field: FieldInfo): field is FieldInfo & { updatedAt: true } {
  const f = field as Record<string, unknown>;
  return typeof f.updatedAt === 'boolean' && f.updatedAt === true;
}

/**
 * 获取关系字段的反向字段名称（backLink）
 * 基于 ZenStack 的 relation.opposite 属性推断
 */
export function getBackLinkFieldName(field: FieldInfo): string | undefined {
  const f = field as FieldInfo & { relation?: { opposite?: string } };
  return f.relation?.opposite;
}

/**
 * 扩展 FieldInfo 类型，包含 backLink 辅助属性
 * 注意：backLink 不是 ZenStack 生成的，而是通过 relation.opposite 推断的
 */
export function getFieldBackLink(field: FieldInfo): string | undefined {
  return getBackLinkFieldName(field);
}

/**
 * 获取模型的 CRUD API 类型
 *
 * 通过映射类型从 API.db 中提取特定模型的类型
 */
export type ModelAPI<M extends DBModelNames> = M extends keyof typeof API.db
  ? typeof API.db[M]
  : never;

/**
 * ZenStack v3 的基础参数类型（从后端导入）
 * 用于 AutoTable 组件的 CRUD 操作类型约束
 * 注意：只导出常用的类型，避免类型实例化过深
 */
export type {
  FindManyArgs,
  FindUniqueArgs,
  FindFirstArgs,
  CreateArgs,
  CreateManyArgs,
  UpdateArgs,
  UpdateManyArgs,
  DeleteArgs,
  DeleteManyArgs,
  CountArgs,
} from '@tsfullstack/backend';

/**
 * 模型的 CRUD 接口定义
 * 用于 AutoTable 组件的数据库操作
 * 只包含常用的 CRUD 方法，避免引入不常用类型的复杂类型
 */
export interface ModelCRUD {
  /** 查找多条记录 */
  findMany(args?: FindManyArgsDynamic): Promise<unknown[]>;
  /** 查找第一条记录 */
  findFirst(args?: FindFirstArgsDynamic): Promise<unknown | null>;
  /** 查找唯一记录 */
  findUnique(args: FindUniqueArgsDynamic): Promise<unknown | null>;
  /** 创建记录 */
  create(args: CreateArgsDynamic): Promise<unknown>;
  /** 更新记录 */
  update(args: UpdateArgsDynamic): Promise<unknown>;
  /** 删除记录 */
  delete(args: DeleteArgsDynamic): Promise<unknown>;
  /** 删除多条记录 */
  deleteMany(args: DeleteManyArgsDynamic): Promise<{ count: number }>;
  /** 统计记录数 */
  count(args?: CountArgsDynamic): Promise<number>;
}

/**
 * 类型安全的模型访问辅助函数
 * 返回模型的 CRUD 接口
 */
export function getModelAPI<M extends DBModelNames>(
  api: typeof API,
  modelName: M
): ModelCRUD {
  // 直接返回 api.db[modelName]，TypeScript 会根据 DBModelNames 确保有正确的类型
  return api.db[modelName] as any;
}

/**
 * 从 PascalCase 模型名转换为小写形式
 * 基于后端允许的方法列表进行类型推断
 */
export function getModelDbName(modelName: ModelMetaNames): DBModelNames {
  // 将首字母小写
  const lowerName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  // 类型断言：我们知道这个转换规则与后端一致
  return lowerName as DBModelNames;
}
