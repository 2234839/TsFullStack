import { schema, type SchemaType } from '../../.zenstack/schema';

/** ZenStack v3 的模型名称列表 - 首字母小写以匹配客户端 API */
export const modelsName = Object.keys(schema.models).map(
  (name) => name.charAt(0).toLowerCase() + name.slice(1),
) as ModelNameUncapitalized[];
type AllPropertyTypes<T> = T[keyof T];
export type ModelNames = AllPropertyTypes<SchemaType['models']>['name'];
type UncapitalizeFirst<T extends string> =
  T extends `${infer First}${infer Rest}` ? `${Uncapitalize<First>}${Rest}` : T;

export type ModelNameUncapitalized = UncapitalizeFirst<ModelNames>;

/** 向后兼容的 ModelMeta 值导出 */
export const ModelMeta = {
  models: schema.models,
  enums: schema.enums || {},
};

/** ModelMeta 的类型定义 */
export type ModelMeta = typeof ModelMeta;
