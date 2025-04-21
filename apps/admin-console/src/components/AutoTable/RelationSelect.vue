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

  const props = defineProps<{
    field: FieldInfo;
    modelValue: any[] | undefined;
  }>();
  const modelMeta = inject(injectModelMetaKey)!;

  const modelValue = ref<any[]>([...(props.modelValue ?? [])]);
  const emit = defineEmits<{
    (e: 'selected', value: any[]): void;
  }>();
  watchEffect(() => {
    emit('selected', [...modelValue.value]);
  });

  import { useAPI } from '@/api';
  import { findIdField } from '@/components/AutoTable/util';
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

    const relatedModelName = field.type;
    const relatedModelKey = Object.keys(modelMeta.models).find(
      (key) => modelMeta?.models[key].name === relatedModelName,
    ) as DBmodelNames;

    if (!relatedModelKey) return initObj;

    const idField = findIdField(modelMeta, relatedModelName);
    if (!idField) return initObj;

    const displayField =
      Object.values(modelMeta.models[relatedModelKey].fields).find(
        (f: FieldInfo) => f.type === 'String' && !f.isId,
      ) || idField;

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
          [idField.name]: true,
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
        value: record[idField.name],
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
