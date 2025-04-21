<style scoped></style>
<template>
  <MultiSelect
    v-if="field.isArray"
    :id="'field-' + field.name"
    v-model="selectModel"
    :options="relationsData.state.value"
    optionLabel="label"
    optionValue="value"
    :class="{ 'p-invalid': fieldErrors[field.name] }"
    :placeholder="t('请选择关联记录')"
    :loading="relationsData.isLoading.value"
    @before-show="relationsData.execute(100,field)" />
  <Select
    v-else
    :id="'field-' + field.name"
    v-model="selectModel"
    :options="relationsData.state.value"
    optionLabel="label"
    optionValue="value"
    :class="{ 'p-invalid': fieldErrors[field.name] }"
    :placeholder="t('请选择关联记录')"
    :loading="relationsData.isLoading.value"
    @before-show="relationsData.execute(100,field)" />
</template>
<script setup lang="ts">
  import { useAPI } from '@/api';
  import type { DBmodelNames, FieldInfo, ModelMeta } from '@/components/AutoTable/type';
  import { findIdField } from '@/components/AutoTable/util';
  import { useAsyncState } from '@vueuse/core';
  import { MultiSelect, Select, useToast } from 'primevue';
  import { useI18n } from 'vue-i18n';

  const props = defineProps<{
    field: FieldInfo;
    modelMeta: ModelMeta;
    fieldErrors:Record<string, string>
  }>();

  const selectModel = defineModel();
  const { API } = useAPI();
  const toast = useToast();
  const { t } = useI18n();
  const relationsData = useAsyncState(async function loadRelationData(field: FieldInfo) {
    if (!field.isDataModel || !props.modelMeta) return [];

    const relatedModelName = field.type;
    const relatedModelKey = Object.keys(props.modelMeta.models).find(
      (key) => props.modelMeta?.models[key].name === relatedModelName,
    ) as DBmodelNames;

    if (!relatedModelKey) return;

    // 查找关联模型的ID字段
    const idField = findIdField(props.modelMeta, relatedModelName);
    if (!idField) return;

    // 查找一个可以用作显示标签的字段（优先选择String类型）
    const displayField =
      Object.values(props.modelMeta.models[relatedModelKey].fields).find(
        (f: FieldInfo) => f.type === 'String' && !f.isId,
      ) || idField;

    try {
      const records = await API.db[relatedModelKey].findMany({
        select: {
          [idField.name]: true,
          [displayField.name]: true,
        },
        take: 100, // 限制加载数量
      });

      return records.map((record: any) => ({
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
  }, []);

  // 加载关系数据 - 现在只在用户点击下拉框时触发
</script>
