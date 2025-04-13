import __ModelMeta from '@zenstackhq/runtime/model-meta';

// @ts-expect-error  修复默认导出问题
export const ModelMeta: typeof __ModelMeta = __ModelMeta['default']
  ? // @ts-expect-error
    __ModelMeta['default']
  : __ModelMeta;

/** 获取所有模型名称   */
export const modelsName = Object.keys(ModelMeta.models) as (keyof typeof __ModelMeta.models)[];
