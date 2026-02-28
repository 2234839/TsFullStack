import { useAsyncState, useDebounceFn } from '@vueuse/core';
import { API } from '../../api';
import type { FieldInfo, ModelMeta, DBModelNames, ModelMetaNames } from './type';
import { isIdField } from './type';

// 重新导出辅助函数（供其他组件使用）
export {
  isIdField,
  isArrayField,
  isOptionalField,
  isDataModelField,
  hasDefaultField,
  isUpdatedAtField,
  getModelDbName,
  getModelAPI,
} from './type';

/**
 * 查找一个可以用于更新指定记录的唯一主键字段
 * @param modelMeta 模型元数据
 * @param modelName 模型名称（PascalCase，如 'Role', 'User'）
 */
export function findIdField(modelMeta: ModelMeta, modelName: string): FieldInfo | undefined {
  const model = Object.values(modelMeta.models).find((el) => el.name === modelName);
  if (!model) return undefined;
  const idField = Object.values(model.fields).find((el) => isIdField(el as FieldInfo));
  return idField as FieldInfo;
}

/**
 * 查找一个可以用作显示的列
 * TODO 之后应该要支持自定义显示字段，这里暂时先用第一个 string 类型的字段代替
 * @param modelMeta 模型元数据
 * @param refModelKey 模型键（PascalCase，如 'Role', 'User'）
 */
export function findDisplayField(modelMeta: ModelMeta, refModelKey: ModelMetaNames) {
  const model = modelMeta.models[refModelKey as keyof typeof modelMeta.models];
  const displayField = Object.values(model?.fields || {}).find(
    (f: FieldInfo) => f.type === 'String' && !isIdField(f),
  );
  return displayField;
}

/**
 * 获取模型键
 * 这个 modelKey 就是用于访问 modelMeta.models[modelKey] 的，他和模型名称一致（PascalCase）
 * @param modelMeta 模型元数据
 * @param modelName 模型名称（PascalCase，如 'Role', 'User'）
 */
export function getModelKey(modelMeta: ModelMeta, modelName: string): ModelMetaNames | undefined {
  return Object.keys(modelMeta.models).find((key) => (modelMeta.models as any)[key]?.name === modelName) as ModelMetaNames | undefined;
}

/**
 * 将 PascalCase 模型名转换为小写形式（用于 API.db 调用）
 * 根据 ZenStack v3 的命名规则自动转换：首字母小写
 * @param modelName PascalCase 模型名（如 'Role', 'User', 'OAuthAccount'）
 * @returns 小写模型名（如 'role', 'user', 'oAuthAccount'）
 */
export function modelNameToDbName(modelName: string): DBModelNames {
  // 将首字母小写
  return modelName.charAt(0).toLowerCase() + modelName.slice(1) as DBModelNames;
}

//#region modelMeta ,只有调用 useModelMeta 之后，才会发起请求获取 modelMeta 数据
const debouncedGetModleMeta = useDebounceFn(async () => {
  const meta = await API.system.getModelMeta();
  return meta as unknown as ModelMeta;
}, 100);
const modelMeta = useAsyncState(debouncedGetModleMeta, undefined, {
  immediate: false,
});
export async function useModelMeta() {
  if (!modelMeta.state.value) {
    await modelMeta.execute();
  }
  return modelMeta;
}
//#endregion
