<template>
  <RemoteSelect v-model="modelValue" :queryMethod="queryData" />
</template>

<script setup lang="ts">
  import {
    injectModelMetaKey,
    type DBmodelNames,
    type FieldInfo,
    type ModelMeta,
  } from '@/components/AutoTable/type';
  import RemoteSelect from '@/components/base/RemoteSelect.vue';
  import { inject, ref, watchEffect } from 'vue';
  import { useAPI } from '@/api';
  import { findDisplayField, findIdField } from '@/components/AutoTable/util';

  const props = defineProps<{
    field: FieldInfo;
    modelValue: any[] | undefined;
  }>();
  const modelMeta = inject(injectModelMetaKey)!;
  interface SelectItem {
    value: any;
    label: string;
  }
  const emit = defineEmits<{
    (e: 'selected', value: any[]): void;
  }>();

  //#region 显示列相关数据
  const relatedModelName = props.field.type;
  const relatedModelKey = Object.keys(modelMeta.models).find(
    (key) => modelMeta?.models[key].name === relatedModelName,
  ) as DBmodelNames;
  const refIdField = findIdField(modelMeta, relatedModelName)!;
  const displayField = findDisplayField(modelMeta, relatedModelKey) || refIdField;
  //#endregion

  const modelValue = ref<SelectItem[]>(
    [...(props.modelValue ?? [])].map((el) => ({
      label: el[displayField.name],
      value: el[refIdField.name],
    })),
  );
  watchEffect(() => {
    emit(
      'selected',
      [...modelValue.value].map((el) => ({
        [displayField.name]: el.label,
        [refIdField.name]: el.value,
      })),
    );
  });

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
    if (!field.isDataModel || !modelMeta) return initObj;

    const where = search
      ? {
          [displayField.name]: {
            contains: search,
            mode: 'insensitive',
          },
        }
      : {};

    const [list, count] = await Promise.all([
      API.db[relatedModelKey].findMany({
        where,
        select: {
          [refIdField.name]: true,
          [displayField.name]: true,
        },
        skip,
        take,
      }),
      API.db[relatedModelKey].count({ where }),
    ]);
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
