<style scoped></style>
<template>
  <div class="flex space-x-1 my-1">
    <SelectButton v-model="selectModelName" :options="Object.keys(models)" />
    <div class="flex items-center space-x-2" v-if="editRows.length">
      <Button @click="saveChanges">保存修改结果</Button>
      <Button @click="discardChanges" severity="secondary">丢弃修改</Button>
      <span> {{ editRows.length }} 行已修改 </span>
    </div>
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
      <template #body="{ data, index }">
        <AutoColumn
          :row="data"
          :field="(field as any)"
          v-model:edit-value="editData[index][field.name]" />
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
  import { Button, Column, DataTable, Paginator, SelectButton } from 'primevue';
  import { computed, ref, watchEffect } from 'vue';
  import { API } from '../../api';
  import AutoColumn from './AutoColumn.vue';
  import type { Field, ModelMeta, modelNames } from './type';

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

  //#region 表格分页
  const currentPage = ref(1);
  const pageSize = ref(10);
  const firstRecord = ref(0);
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
  //#endregion 表格分页

  /** 编辑数据的临时存储，用于保存每行的编辑结果  */
  const editData = ref<Array<Record<string, any>>>([]);
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
      editData.value = list.map((_) => ({}));
      return { list, count };
    },
    { list: [], count: 0 },
    {},
  );

  function reloadTableData() {
    tableData.execute(200, {
      model: selectModelName.value!,
      page: currentPage.value,
      pageSize: pageSize.value,
    });
  }

  /** 切换模型时触发更新 */
  watchEffect(() => {
    if (!selectModelName.value) return;
    reloadTableData();
  });

  //#region 数据编辑更新功能
  /** 当前被编辑了的数据行 */
  const editRows = computed(() => {
    return editData.value.filter((row) => Object.keys(row).length > 0);
  });
  async function saveChanges() {
    if (!selectModelName.value) return;

    /** 查找一个可以用于更新指定记录的唯一主键字段  */
    const idField = Object.values(selectModelMeta.value?.fields ?? []).find(
      (el) => (el as Field).isId,
    );
    if (!idField) return console.error('No ID field found in the model');

    for (let index = 0; index < editData.value.length; index++) {
      const editRow = editData.value[index];
      const editFields = Object.keys(editRow);
      if (editFields.length === 0) continue;

      const rawRow = tableData.state.value.list[index];
      const updateRes = await API.db[selectModelName.value].update({
        data: editRow,
        // @ts-ignore
        where: {
          // @ts-ignore
          [idField.name]: rawRow[idField.name],
        },
        select: {
          [idField.name]: true,
        },
      });
      console.log('[updateRes]', updateRes);
    }
    reloadTableData();
  }
  function discardChanges() {
    editRows.value.forEach((row) => {
      Object.keys(row).forEach((key) => {
        delete row[key];
      });
    });
  }
  //#endregion 数据编辑更新功能
</script>