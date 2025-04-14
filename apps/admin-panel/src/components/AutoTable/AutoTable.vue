<style scoped></style>
<template>
  智能表格
  <div class="flex space-x-1">
    <SelectButton v-model="selectModel" :options="Object.keys(models)" />
  </div>

  <DataTable
    :loading="tableData.isLoading.value"
    :value="tableData.state.value.list"
    tableStyle="min-width: 50rem"
    :rows="pageSize"
    :first="(currentPage - 1) * pageSize"
    :totalRecords="tableData.state.value.count"
    @page="onPageChange">
    <Column field="id" header="id"></Column>
    <Column field="name" header="Name"></Column>
    <Column field="category" header="Category"></Column>
    <Column field="quantity" header="Quantity"></Column>
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

  type ModelMeta = Awaited<ReturnType<typeof API.system.getModelMeta>>;
  type modelNames = keyof ModelMeta['models'];
  const modelMeta = useAsyncState(() => API.system.getModelMeta(), undefined);
  const models = computed(() => {
    const meta = modelMeta.state.value;
    return meta?.models ?? ({} as ModelMeta);
  });

  const selectModel = ref<modelNames>();
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

  const onPageChange = (event: any) => {
    currentPage.value = event.page + 1;
    firstRecord.value = event.first;
    if (selectModel.value) {
      tableData.execute(200, {
        model: selectModel.value,
        page: currentPage.value,
        pageSize: pageSize.value,
      });
    }
  };

  watchEffect(() => {
    if (!selectModel.value) return;
    tableData.execute(200, {
      model: selectModel.value,
      page: currentPage.value,
      pageSize: pageSize.value,
    });
  });
</script>
