<style scoped></style>
<template>
  <div class="flex space-x-1 my-1">
    <div class="flex items-center space-x-2">
      <Button icon="pi pi-plus" @click="openCreateForm" :tooltip="t('新增记录')" />
      <div class="flex items-center space-x-2" v-if="editRows.length">
        <Button @click="saveChanges">{{ t('保存修改结果') }}</Button>
        <Button @click="discardChanges" severity="secondary">{{ t('丢弃修改') }}</Button>
        <span>
          {{ $t('autoTable.affectedRows', { rows: editRows.length, cells: eidtCellCount }) }}
        </span>
      </div>
      <div class="flex items-center space-x-2" v-if="selectRows.length">
        <Button @click="deleteConfirm($event)" severity="danger"
          >Delete( {{ selectRows.length }} )</Button
        >
      </div>
    </div>
  </div>
  <AutoFilter v-if="selectModelMeta" :modelFields="selectModelMeta.model.fields" />
  <DataTable
    :loading="tableData.isLoading.value"
    :value="tableData.state.value.list"
    v-model:selection="selectRows"
    tableStyle="--p-datatable-body-cell-sm-padding:0"
    :size="'small'"
    showGridlines
    stripedRows
    editMode="cell">
    <Column selectionMode="multiple" body-style="padding:0 7px"></Column>
    <Column :field="field.name" :header="field.name" v-for="field of selectModelMeta?.model.fields">
      <template #body="{ data, index }">
        <AutoColumn
          :row="data"
          :field="(field as any)"
          v-model:edit-value="editData[index][field.name]" />
      </template>
    </Column>
    <template #footer>
      <Paginator
        v-model:rows="pageSize"
        :totalRecords="tableData.state.value.count"
        v-model:first="firstRecord"
        @page="onPageChange"
        :rowsPerPageOptions="[10, 20, 30]" />
    </template>
  </DataTable>
  <AutoForm
    v-if="selectModelMeta && modelMeta.state.value"
    ref="__createFormRef"
    :modelName="selectModelName"
    :modelKey="selectModelMeta.modelKey"
    :modelFields="selectModelMeta.model.fields || {}"
    :modelMeta="modelMeta.state.value" />
</template>
<script setup lang="ts">
  import { useAsyncState } from '@vueuse/core';
  import { Button, Column, DataTable, Paginator, useConfirm, useToast } from 'primevue';
  import { computed, ref, useTemplateRef, watchEffect } from 'vue';
  import AutoColumn from './AutoColumn.vue';
  import type { DBmodelNames, FieldInfo } from './type';
  import { findIdField, getModelKey, useModelMeta } from './util';
  import { useI18n } from 'vue-i18n';
  import { useAPI } from '@/api';
  import AutoFilter from '@/components/AutoTable/AutoFilter.vue';
  import AutoForm from '@/components/AutoTable/AutoForm.vue';
  const { t } = useI18n();
  const confirm = useConfirm();
  const toast = useToast();
  const { API } = useAPI();

  const modelMeta = useModelMeta();
  const models = computed(() => {
    const meta = modelMeta.state.value;
    return meta?.models ?? {};
  });
  const selectModelName = defineModel<string>('modelName', {
    required: true,
  });
  const selectRows = ref([]);
  const selectModelMeta = computed(() => {
    if (!selectModelName.value) return undefined;
    return Object.entries(models.value)
      .map(([modelKey, model]) => {
        return {
          modelKey,
          model,
        };
      })
      .find((el) => el.model.name === selectModelName.value);
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
        modelKey: selectModelName.value,
        page: currentPage.value,
        pageSize: pageSize.value,
      });
    }
  };
  //#endregion 表格分页

  //#region 表格数据存储及加载
  /** 编辑数据的临时存储，用于保存每行的编辑结果  */
  const editData = ref<Array<Record<string, any>>>([] as rowsType[]);
  type rowsType = Awaited<ReturnType<(typeof API.db)[DBmodelNames]['findMany']>>;
  const tableData = useAsyncState(
    async (opt: { modelKey: string; page: number; pageSize: number }) => {
      const meta = modelMeta.state.value;
      if (!opt.modelKey || !meta) return { list: [], count: 0 };
      const dataModelFields = Object.values(models.value[opt.modelKey].fields).filter(
        (el) => (el as FieldInfo).isDataModel,
      );
      const include = dataModelFields.reduce((acc, field) => {
        const modelName = field.isDataModel ? field.type : field.name;
        const idField = findIdField(meta, modelName);
        const modelKey = getModelKey(meta, modelName);
        if (!idField || !modelKey) return acc;
        acc[field.name] = {
          select: {
            [idField.name]: true,
          },
        };
        return acc;
      }, {} as Record<string, any>);

      const [list, count] = await Promise.all([
        API.db[opt.modelKey as DBmodelNames].findMany({
          take: opt.pageSize,
          skip: (opt.page - 1) * opt.pageSize,
          include,
        }),
        API.db[opt.modelKey as DBmodelNames].count({}),
      ]);
      //#region 清理数据
      editData.value = list.map((_) => ({}));
      selectRows.value = [];
      //#endregion 清理数据
      return { list, count };
    },
    { list: [], count: 0 },
    {},
  );
  function reloadTableData() {
    if (!selectModelMeta.value?.modelKey) return;
    tableData.execute(200, {
      modelKey: selectModelMeta.value!.modelKey,
      page: currentPage.value,
      pageSize: pageSize.value,
    });
  }
  //#endregion

  /** 切换模型时触发更新 */
  watchEffect(() => {
    if (!selectModelName.value) return;
    reloadTableData();
  });

  //#region 数据编辑相关逻辑功能
  /** 当前被编辑了的数据行 */
  const editRows = computed(() => {
    return editData.value.filter((row) => Object.keys(row).length > 0);
  });
  const eidtCellCount = computed(() => {
    return editRows.value.reduce((acc, row) => acc + Object.keys(row).length, 0);
  });
  async function saveChanges() {
    if (!selectModelName.value) return;

    /** 查找一个可以用于更新指定记录的唯一主键字段  */
    const idField = findIdField(modelMeta.state.value!, selectModelName.value);
    if (!idField) return console.error('No ID field found in the model');

    for (let index = 0; index < editData.value.length; index++) {
      const editRow = editData.value[index];
      const editFields = Object.keys(editRow);
      if (editFields.length === 0) continue;

      const rawRow = tableData.state.value.list[index];
      const updateRes = await API.db[selectModelMeta.value!.modelKey as DBmodelNames].update({
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
  async function deleteRows(rows: rowsType) {
    /** 查找一个可以用于更新指定记录的唯一主键字段  */
    const idField = findIdField(modelMeta.state.value!, selectModelName.value);
    if (!idField) return console.error('No ID field found in the model');
    if (rows.length === 0)
      return toast.add({
        severity: 'info',
        summary: 'Warn',
        detail: t('未选中数据'),
        life: 3000,
      });
    await API.db[selectModelMeta.value!.modelKey as DBmodelNames].deleteMany({
      where: {
        OR: rows.map((row) => {
          return {
            // @ts-ignore
            [idField.name]: row[idField.name],
          };
        }),
      },
    });
    toast.add({
      severity: 'info',
      summary: '删除数据',
      detail: '删除数据完毕',
      life: 3000,
    });
    reloadTableData();
  }
  function deleteConfirm(event: MouseEvent) {
    confirm.require({
      target: event.currentTarget as HTMLElement,
      message: '确定删除吗？',
      icon: 'pi pi-exclamation-triangle',
      rejectProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: 'Delete！',
        severity: 'danger',
      },
      accept: () => {
        deleteRows(selectRows.value);
      },
    });
  }
  //#endregion 数据编辑更新功能

  //#region 新增记录功能
  const createFormRef = useTemplateRef('__createFormRef');
  function openCreateForm() {
    if (createFormRef.value) {
      createFormRef.value.open();
    }
  }

  function onRecordCreated() {
    reloadTableData();
  }
  //#endregion
</script>
