import { schema, type SchemaType } from '../../.zenstack/schema';

type AllPropertyTypes<T> = T[keyof T];
export type ModelNames = AllPropertyTypes<SchemaType['models']>['name'];
type UncapitalizeFirst<T extends string> =
  T extends `${infer First}${infer Rest}` ? `${Uncapitalize<First>}${Rest}` : T;

export type ModelNameUncapitalized = UncapitalizeFirst<ModelNames>;

/** 向后兼容的 ModelMeta 值导出 */
export const ModelMeta = {
  models: schema.models,
  enums: schema.enums ?? {},
};

/** ModelMeta 的类型定义 */
export type ModelMeta = typeof ModelMeta;
