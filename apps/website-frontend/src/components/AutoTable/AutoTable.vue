<style scoped></style>
<template>
  <div class="flex space-x-1 my-1">
    <div class="flex items-center space-x-2">
      <Button icon="pi pi-plus" @click="openCreateForm" :tooltip="t('新增记录')" />
      <template v-if="editRows.length">
        <Button @click="saveChanges">{{ t('保存修改结果') }}</Button>
        <Button @click="discardChanges" severity="secondary">{{ t('丢弃修改') }}</Button>
        <span>
          {{ $t('autoTable.affectedRows', { rows: editRows.length, cells: eidtCellCount }) }}
        </span>
      </template>
      <Button v-if="selectRows.length" @click="deleteConfirm($event)" severity="danger">
        Delete( {{ selectRows.length }} )
      </Button>
    </div>
  </div>
  <AutoFilter
    v-if="selectModelMeta"
    :modelFields="selectModelMeta.model.fields"
    @filter="
      (options) => {
        filter = options;
        currentPage = 1;
        reloadTableData();
      }
    " />
  <DataTable
    :loading="tableData.isLoading.value"
    :value="tableData.state.value.list"
    v-model:selection="selectRows"
    tableStyle="--p-datatable-body-cell-sm-padding:0"
    size="small"
    showGridlines
    stripedRows
    editMode="cell">
    <Column selectionMode="multiple" body-style="padding:0 7px"></Column>
    <Column
      :field="field.name"
      :header="field.name"
      v-for="field of tableData.state.value.modelFields">
      <template #body="{ data, index }">
        <AutoColumn
          :row="data"
          :field="(field as any)"
          :editValue="editData[index]?.[field.name]"
          @update:editValue="(newVal) => (editData[index][field.name] = newVal)" />
      </template>
    </Column>
    <template #footer>
      <div class="flex justify-center gap-1 items-center">
        <Paginator
          v-model:rows="pageSize"
          :totalRecords="tableData.state.value.count"
          v-model:first="firstRecord"
          @page="onPageChange"
          :rowsPerPageOptions="[10, 20, 30]" />
        {{ t('总计') }}：{{ tableData.state.value.count }} {{ t('行') }}
      </div>
    </template>
  </DataTable>
  <AutoForm
    v-if="selectModelMeta && modelMeta.state.value"
    ref="__createFormRef"
    :modelKey="selectModelMeta.modelKey"
    :modelFields="selectModelMeta.model.fields || {}"
    :modelMeta="modelMeta.state.value"
    @created="onRecordCreated()" />
</template>
<script setup lang="ts">
  import { useAPI } from '@/api';
  import AutoFilter from '@/components/AutoTable/AutoFilter.vue';
  import AutoForm from '@/components/AutoTable/AutoForm.vue';
  import { useAsyncState } from '@vueuse/core';
  import { Button, Column, DataTable, Paginator, useConfirm, useToast } from 'primevue';
  import { computed, nextTick, provide, ref, useTemplateRef, watch } from 'vue';
  import { useI18n } from 'vue-i18n';
  import AutoColumn from './AutoColumn.vue';
  import { injectModelMetaKey, type DBmodelNames, type FieldInfo } from './type';
  import { findDisplayField, findIdField, getModelKey, useModelMeta } from './util';
  const { t } = useI18n();
  const confirm = useConfirm();
  const toast = useToast();
  const { API } = useAPI();

  const modelMeta = await useModelMeta();
  provide(injectModelMetaKey, modelMeta.state.value!);
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
    return findModelMeta(selectModelName.value);
  });
  function findModelMeta(modelName: string) {
    return Object.entries(models.value)
      .map(([modelKey, model]) => {
        return {
          modelKey,
          model,
        };
      })
      .find((el) => el.model.name === modelName);
  }
  const filter = ref({});
  //#region 表格分页
  const currentPage = ref(1);
  const pageSize = ref(10);
  const firstRecord = ref(0);
  const onPageChange = (event: { page: number; first: number }) => {
    currentPage.value = event.page + 1;
    firstRecord.value = event.first;
    if (selectModelMeta.value) {
      tableData.execute(0, {
        modelKey: selectModelMeta.value.modelKey,
        page: currentPage.value,
        pageSize: pageSize.value,
      });
    }
  };
  watch(selectModelName, () => {
    // 切换模型时重置
    currentPage.value = 1;
    firstRecord.value = 0;
  });
  //#endregion 表格分页

  //#region 表格数据存储及加载
  /** 编辑数据的临时存储，用于保存每行的编辑结果  */
  const editData = ref<Array<Record<string, any>>>([] as rowsType[]);
  type rowsType = Awaited<ReturnType<(typeof API.db)[DBmodelNames]['findMany']>>;
  const tableData = useAsyncState(
    async (opt: { modelKey: string; page: number; pageSize: number }) => {
      const meta = modelMeta.state.value;
      const models = meta?.models;
      if (!meta || !models) return { list: [], modelFields: {}, count: 0 };

      const modelFields = models[opt.modelKey].fields;
      const dataModelFields = Object.values(modelFields).filter(
        (el) => (el as FieldInfo).isDataModel,
      );

      const include = dataModelFields.reduce((acc, field) => {
        const refModelName = field.isDataModel ? field.type : field.name;
        const refIdField = findIdField(meta, refModelName)!;
        const refModelKey = getModelKey(meta, refModelName)!;
        const refDisplayField = findDisplayField(meta, refModelKey) || refIdField;
        if (!refIdField || !refModelKey) return acc;
        acc[field.name] = {
          select: {
            [refIdField.name]: true,
            [refDisplayField.name]: true,
          },
        };
        return acc;
      }, {} as Record<string, any>);

      const [list, count] = await Promise.all([
        API.db[opt.modelKey as DBmodelNames].findMany({
          take: opt.pageSize,
          skip: (opt.page - 1) * opt.pageSize,
          where: filter.value,
          include,
        }),
        API.db[opt.modelKey as DBmodelNames].count({
          where: filter.value,
        }),
      ]);
      //#region 清理数据
      editData.value = list.map(() => ({}));
      selectRows.value = [];
      //#endregion 清理数据
      return { list, count, modelFields };
    },
    { list: [], modelFields: {}, count: 0 },
    {
      resetOnExecute: false,
      throwError: true,
      immediate: false,
    },
  );
  function reloadTableData() {
    if (!selectModelMeta.value?.modelKey) return;
    tableData.execute(200, {
      modelKey: selectModelMeta.value!.modelKey,
      page: currentPage.value,
      pageSize: pageSize.value,
    });
  }
  /** 切换模型时触发更新 */
  watch(
    selectModelName,
    async (val) => {
      if (!val) return;
      await nextTick(); // 等待其他和 selectModelName 相关的逻辑执行完毕
      reloadTableData();
    },
    { immediate: true },
  );
  //#endregion

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
      const rawRow = tableData.state.value.list[index];
      const editRow = { ...editData.value[index] };
      const editFields = Object.keys(editRow);
      if (editFields.length === 0) continue;

      /** 修改关联字段不能直接修改字段值，需要使用 connect 关联字段的 ID  */
      editFields.forEach((editFieldName) => {
        const field = selectModelMeta.value?.model.fields[editFieldName]!;
        /** 被引用的模型的 id 列定义 */
        const refIdField = findIdField(modelMeta.state.value!, field.type)!;

        if (field.isDataModel) {
          editRow[editFieldName] = {
            connect: editRow[editFieldName].map((item: any) => ({
              [refIdField.name]: item[refIdField.name],
            })),
            // 比较 rawRow 相对于 editRow 中减少的，然后使用 disconnect 断开关联
            disconnect:
              // @ts-ignore
              (rawRow[editFieldName] as any[])
                ?.filter(
                  (item: any) =>
                    !(editRow[editFieldName] as unknown as any[])?.find(
                      (el) => el[refIdField.name] === item[refIdField.name],
                    ),
                )
                ?.map((item: any) => ({ [refIdField.name]: item[refIdField.name] })) || [],
          };
        }
      });
      // API.db.role.update({
      //   where: {
      //     id: 2,
      //   },
      //   data: {
      //     users: {
      //       disconnect: [{}],
      //     },
      //   },
      // });

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
