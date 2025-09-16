import type { ModelMeta } from '@tsfullstack/backend';
import type { API } from '../../api';
import type { InjectionKey } from 'vue';
export type { ModelMeta } from '@tsfullstack/backend';

//#region 当前模型的类型
export type DBModelMeta = Awaited<ReturnType<typeof API.system.getModelMeta>>;
export type DBmodelNames = keyof DBModelMeta['models'];
export type DBFields = DBModelMeta['models'][DBmodelNames]['fields'];
//#endregion

export type Fields = ModelMeta['models'][string]['fields'];
export type FieldInfo = ModelMeta['models'][string]['fields'][string];
export type Model = ModelMeta['models'][string];

export const injectModelMetaKey = Symbol('injectModelMetaKey') as InjectionKey<ModelMeta>
