<template>
  <div>
    <RemoteSelect
      :modelValue="remoteSelectValue"
      @add="(el) => addItem(el)"
      @remove="(el) => removeItem(el)"
      :queryMethod="queryData"
      :showTag="false" />
  </div>
</template>

<script lang="ts">
  import RemoteSelect, {
    RemoteSelectUtils,
    type RemoteSelectItem,
  } from '@/components/base/RemoteSelect.vue';
  export type RelationSelectData = {
    /** 新增和移除，用户手动点击 checked添加的 */
    add: RemoteSelectItem[];
    remove: RemoteSelectItem[];
    /** 之前就在的（在翻页中陆续添加进去） */
    inculdes: RemoteSelectItem[];
  };
</script>
<script setup lang="ts">
  import { useAPI } from '@/api';
  import {
    injectModelMetaKey,
    type FieldInfo,
    type ModelMeta,
    isDataModelField,
    type ModelMetaNames,
    getBackLinkFieldName,
    getModelDbName,
    getModelAPI,
  } from '@/components/AutoTable/type';
  import { findDisplayField, findIdField } from '@/components/AutoTable/util';

  import { computed, inject, reactive } from 'vue';

  const props = defineProps<{
    field: FieldInfo;
    row?: { [fieldName: string]: any };
  }>();

  /** item 都是 RelationData 的 item */
  const modelValue = reactive({
    add: [] as RemoteSelectItem[],
    remove: [] as RemoteSelectItem[],

    inculdes: [] as RemoteSelectItem[],
  });

  function addItem(item: RemoteSelectItem) {
    RemoteSelectUtils.removeItem(modelValue.remove, item);
    RemoteSelectUtils.addItem(modelValue.add, item);
    emit('change', modelValue);
  }
  function removeItem(item: RemoteSelectItem) {
    RemoteSelectUtils.removeItem(modelValue.add, item);
    RemoteSelectUtils.addItem(modelValue.remove, item);
    emit('change', modelValue);
  }

  function mapRemoteSelectItem(el: any): RemoteSelectItem {
    return {
      value: el[refIdField.name],
      label: el[displayField.name] || el[refIdField.name],
    };
  }

  const remoteSelectValue = computed<RemoteSelectItem[]>(() => {
    const selectList = [...modelValue.add, ...modelValue.inculdes];
    const list = selectList.filter(
      (el) =>
        /** 过滤存在于 remove 列表中的元素 */
        !modelValue.remove.some((removeItem) => RemoteSelectUtils.itemEquals(el, removeItem)),
    );
    return list;
  });

  const modelMeta = inject(injectModelMetaKey)!;
  const emit = defineEmits<{
    (e: 'change', value: any): void;
  }>();

  //#region 列相关数据
  const relatedModelName = props.field.type as string;
  const relatedModel = Object.values(modelMeta.models).find(
    (model) => model.name === relatedModelName,
  )!;
  const relatedModelKey = Object.keys(modelMeta.models).find(
    (key) => (modelMeta?.models as any)[key]?.name === relatedModelName,
  ) as ModelMetaNames;

  const refIdField = findIdField(modelMeta, relatedModelName)!;
  const displayField = findDisplayField(modelMeta, relatedModelKey) || refIdField;

  // 获取反向字段名称（基于 ZenStack relation.opposite）
  const backLinkFieldName = getBackLinkFieldName(props.field);
  const rowModelIdField = backLinkFieldName
    ? findIdField(modelMeta, (relatedModel.fields as unknown as Record<string, FieldInfo>)[backLinkFieldName]?.type as string || '')
    : undefined;
  //#endregion

  const { API } = useAPI();
  async function loadRelationData(
    modelMeta: ModelMeta,
    field: FieldInfo,
    skip = 0,
    take = 10,
    search = '',
  ) {
    const initObj = {
      list: [],
      count: 0,
    };
    if (!isDataModelField(field) || !modelMeta) return initObj;

    const where = search
      ? {
          [displayField.name]: {
            contains: search,
          },
        }
      : {};

    const modelIdValue = rowModelIdField ? props.row?.[rowModelIdField.name] : undefined;
    // 类型安全的模型访问
    const relatedDbName = getModelDbName(relatedModelKey);
    const relatedAPI = getModelAPI(API, relatedDbName);
    const [list, count] = await Promise.all([
      relatedAPI.findMany({
        where,
        select: {
          [refIdField.name]: true,
          [displayField.name]: true,
          /** 需要查询出反向关系的数据，用于判断是否被引用了  */
          ...(backLinkFieldName && {
            [backLinkFieldName]: {
              /** 当没有id时就是where条件不成立了 */
              ...(rowModelIdField && modelIdValue && {
                where: {
                  [rowModelIdField.name]: props.row?.[rowModelIdField.name] ?? null,
                },
              }),

              select: {
                ...(rowModelIdField && {
                  [rowModelIdField.name]: true,
                }),
              },
            },
          }),
        },
        skip,
        take,
      } as any),
      relatedAPI.count({ where } as any),
    ]);
    list.forEach((el: any) => {
      if (!backLinkFieldName || !el[backLinkFieldName].length || !modelIdValue) return;
      // 应该先判断是否存在与 add 或remove 中，存在则跳过
      const selectItem = mapRemoteSelectItem(el);
      if (modelValue.add.some((item) => RemoteSelectUtils.itemEquals(item, selectItem))) return;
      if (modelValue.remove.some((item) => RemoteSelectUtils.itemEquals(item, selectItem))) return;
      if (modelValue.inculdes.some((item) => RemoteSelectUtils.itemEquals(item, selectItem)))
        return;
      modelValue.inculdes.push(selectItem);
    });

    return {
      list: list.map((record: any) => ({
        label: String(record[displayField.name]),
        value: record[refIdField.name],
      })),
      count,
    };
  }

  const queryData = async (param: { keyword: string; skip: number; take: number }) => {
    const { count, list } = await loadRelationData(
      modelMeta,
      props.field,
      param.skip,
      param.take,
      param.keyword,
    );
    return {
      data: list,
      total: count,
    };
  };
</script>
