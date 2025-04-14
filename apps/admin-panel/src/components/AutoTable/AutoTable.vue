<style scoped></style>
<template>
  智能表格
  <div class="flex space-x-1">
    <SelectButton v-model="selectModelName" :options="Object.keys(models)" />
  </div>
  <DataTable
    :loading="tableData.isLoading.value"
    :value="tableData.state.value.list"
    tableStyle="--p-datatable-body-cell-sm-padding:0"
    :size="'small'"
    showGridlines
    stripedRows
    editMode="cell"
    :rows="pageSize"
    :first="(currentPage - 1) * pageSize"
    :totalRecords="tableData.state.value.count"
    @page="onPageChange">
    <Column :field="field.name" :header="field.name" v-for="field of selectModelMeta?.fields">
      <template #body="{ data }">
        <AutoColumn :row="data" :field="(field as any)" />
      </template>
    </Column>
    <template #footer>
      <Paginator
        :rows="pageSize"
        :totalRecords="tableData.state.value.count"
        v-model:first="firstRecord"
        @page="onPageChange" />
    </template>
  </DataTable>
</template>
<script setup lang="ts">
  import { useAsyncState } from '@vueuse/core';
  import { Column, DataTable, Paginator, SelectButton } from 'primevue';
  import { computed, ref, watchEffect } from 'vue';
  import { API } from '../../api';
  import AutoColumn from './AutoColumn.vue';
  import type { ModelMeta, modelNames } from './type';

  const modelMeta = useAsyncState(() => API.system.getModelMeta(), undefined);
  const models = computed<ModelMeta['models']>(() => {
    const meta = modelMeta.state.value;
    return meta?.models ?? ({} as ModelMeta['models']);
  });

  const selectModelName = ref<modelNames>();
  const selectModelMeta = computed(() => {
    if (!selectModelName.value) return undefined;
    return models.value[selectModelName.value];
  });
  const currentPage = ref(1);
  const pageSize = ref(10);
  const firstRecord = ref(0);

  const tableData = useAsyncState(
    async (opt: { model: modelNames; page: number; pageSize: number }) => {
      if (!opt.model) return { list: [], count: 0 };
      const [list, count] = await Promise.all([
        API.db[opt.model].findMany({
          take: opt.pageSize,
          skip: (opt.page - 1) * opt.pageSize,
        }),
        API.db[opt.model].count({}),
      ]);
      return { list, count };
    },
    { list: [], count: 0 },
    {},
  );

  const onPageChange = (event: { page: number; first: number }) => {
    currentPage.value = event.page + 1;
    firstRecord.value = event.first;
    if (selectModelName.value) {
      tableData.execute(200, {
        model: selectModelName.value,
        page: currentPage.value,
        pageSize: pageSize.value,
      });
    }
  };

  watchEffect(() => {
    if (!selectModelName.value) return;
    tableData.execute(200, {
      model: selectModelName.value,
      page: currentPage.value,
      pageSize: pageSize.value,
    });
  });
</script>
