import { useAsyncState, useDebounceFn } from '@vueuse/core';
import { API } from '../../api';
import type { FieldInfo, ModelMeta } from './type';

/** 查找一个可以用于更新指定记录的唯一主键字段  */
export function findIdField(modelMeta: ModelMeta, modelName: string): FieldInfo | undefined {
  const model = Object.values(modelMeta.models).find((el) => el.name === modelName);
  const idField = Object.values(model?.fields ?? []).find((el) => (el as FieldInfo).isId);
  return idField;
}

/** 这个 modelKey 就是用于访问 modelMeta.models[modelKey]  的，他和模型名称不一致 */
export function getModelKey(modelMeta: ModelMeta, modelName: string): string | undefined {
  return Object.keys(modelMeta.models).find((key) => modelMeta.models[key].name === modelName);
}

//#region modelMeta ,只有调用 useModelMeta 之后，才会发起请求获取 modelMeta 数据
const debouncedGetModleMeta = useDebounceFn(() => API.system.getModelMeta() as Promise<ModelMeta>, 30);
const modelMeta = useAsyncState(debouncedGetModleMeta, undefined, {
  immediate: false,
});
export function useModelMeta() {
  if (!modelMeta.state.value) {
    modelMeta.execute();
  }
  return modelMeta;
}
//#endregion
