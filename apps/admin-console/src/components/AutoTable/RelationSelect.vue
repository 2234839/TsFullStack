<template>
  <RemoteSelect v-model="modelValue" :queryMethod="queryData" />
</template>

<script setup lang="ts">
  import { useAPI } from '@/api';
  import {
    injectModelMetaKey,
    type DBmodelNames,
    type FieldInfo,
    type ModelMeta,
  } from '@/components/AutoTable/type';
  import { findIdField } from '@/components/AutoTable/util';
  import RemoteSelect from '@/components/base/RemoteSelect.vue';
  import { useAsyncState } from '@vueuse/core';
  import { useToast } from 'primevue';
  import { inject, ref, watchEffect } from 'vue';
  import { useI18n } from 'vue-i18n';

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

  const { API } = useAPI();
  const toast = useToast();
  const { t } = useI18n();
  const totalRecords = ref(0);

  const relationsData = useAsyncState(async function loadRelationData(
    field: FieldInfo,
    skip = 0,
    take = 10,
    search = '',
  ) {
    if (!field.isDataModel || !modelMeta) return [];

    const relatedModelName = field.type;
    const relatedModelKey = Object.keys(modelMeta.models).find(
      (key) => modelMeta?.models[key].name === relatedModelName,
    ) as DBmodelNames;

    if (!relatedModelKey) return [];

    const idField = findIdField(modelMeta, relatedModelName);
    if (!idField) return [];

    const displayField =
      Object.values(modelMeta.models[relatedModelKey].fields).find(
        (f: FieldInfo) => f.type === 'String' && !f.isId,
      ) || idField;

    try {
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

      totalRecords.value = count;
      return list.map((record: any) => ({
        label: String(record[displayField.name]),
        value: record[idField.name],
      }));
    } catch (error) {
      console.error(`Failed to load relation data for ${field.name}:`, error);
      toast.add({
        severity: 'error',
        summary: t('错误'),
        detail: t('加载关联数据失败'),
        life: 3000,
      });
      return [];
    }
  },
  []);
  const queryData = async (param: { keyword: string; skip: number; take: number }) => {
    const data = await relationsData.execute(
      100,
      props.field,
      param.skip,
      param.take,
      param.keyword,
    );
    return {
      data,
      total: totalRecords.value,
    };
  };
</script>
