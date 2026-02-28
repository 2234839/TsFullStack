<style scoped></style>
<template>
  <div class="flex space-x-1 my-1">
    <div class="flex items-center space-x-2">
      <Button icon="pi pi-plus" @click="openCreateForm" :tooltip="t('新增记录')" />
      <template v-if="editRows.length">
        <Button @click="saveChanges">{{ t('保存修改结果') }}</Button>
        <Button @click="discardChanges" variant="secondary">{{ t('丢弃修改') }}</Button>
        <span>
          {{ t('autoTable.affectedRows', { rows: editRows.length, cells: eidtCellCount }) }}
        </span>
      </template>
      <Button v-if="selectRows.length" @click="deleteConfirm($event)" variant="danger">
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
    :data="tableData.state.value.list"
    :loading="tableData.isLoading.value"
    :selectedRowKeys="selectRows"
    @update:selectedRowKeys="selectRows = $event"
    rowKey="id"
    size="small"
    striped
    bordered
    selectable
    :columns="tableColumns">
  </DataTable>
  <!-- 分页 -->
  <div class="flex justify-center gap-1 items-center mt-4 text-sm">
    <Paginator
      v-model:rows="pageSize"
      :totalRecords="tableData.state.value.count"
      v-model:first="firstRecord"
      @page="onPageChange"
      :rowsPerPageOptions="[10, 20, 30]" />
    {{ t('总计') }}：{{ tableData.state.value.count }} {{ t('行') }}
  </div>
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
  import type { RelationSelectData } from '@/components/AutoTable/RelationSelect.vue';
  import { useAsyncState } from '@vueuse/core';
  import { Button, DataTable, Paginator } from '@/components/base';
  import { useConfirm } from '@/composables/useConfirm';
  import { useToast } from '@/composables/useToast';
  import { computed, h, nextTick, provide, ref, useTemplateRef, watch } from 'vue';
  import { useI18n } from '@/composables/useI18n';
  import AutoColumn from './AutoColumn.vue';
  import { injectModelMetaKey, type ModelMetaNames, type Model, type FieldInfo, getModelAPI, isDataModelField } from './type';
  import { findIdField, useModelMeta, getModelDbName as exportGetModelDbName } from './util';
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
  const selectRows = ref<any[]>([]);

  /** 表格列定义 */
  const tableColumns = computed(() => {
    const fields = tableData.state.value.modelFields;
    return Object.entries(fields).map(([fieldName, field]) => ({
      key: fieldName,
      title: fieldName,
      render: (row: any, index: number) => {
        return h(AutoColumn, {
          row,
          field,
          editValue: editData.value[index]?.[fieldName],
          'onUpdate:editValue': (newVal: any) => {
            if (editData.value[index]) {
              editData.value[index][fieldName] = newVal;
            }
          },
        });
      },
    }));
  });

  const selectModelMeta = computed(() => {
    if (!selectModelName.value) return undefined;
    return findModelMeta(selectModelName.value);
  });

  function findModelMeta(modelName: string): { modelKey: string; model: Model } | undefined {
    const result = Object.entries(models.value)
      .map(([modelKey, model]) => {
        return {
          modelKey,
          model,
        };
      })
      .find((el) => (el.model as Model).name === modelName);
    return result as { modelKey: string; model: Model } | undefined;
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
  const editData = ref<Array<Record<string, any>>>([]);
  const tableData = useAsyncState(
    async (opt: { modelKey: string; page: number; pageSize: number }) => {
      const meta = modelMeta.state.value;
      const models = meta?.models;
      if (!meta || !models) return { list: [], modelFields: {}, count: 0 };
  
      const modelFields = (models[opt.modelKey as ModelMetaNames]?.fields || {}) as unknown as Record<string, FieldInfo>;
      let _count = { select: {} as { [key: string]: boolean } };
      Object.entries(modelFields).forEach(([key, field]) => {
        if ('relation' in field && 'array' in field && field.array) {
          _count.select[key] = true;
        }
      });
      // 类型安全的模型访问
      const modelName = exportGetModelDbName(opt.modelKey as ModelMetaNames);
      const modelAPI = getModelAPI(API, modelName);
      const [list, count] = await Promise.all([
        modelAPI.findMany({
          take: opt.pageSize,
          skip: (opt.page - 1) * opt.pageSize,
          where: filter.value,
          ...(Object.keys(_count.select).length > 0 && {
            include: { _count },
          }),
        }),
        modelAPI.count({
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
        const field = (selectModelMeta.value?.model.fields as unknown as Record<string, FieldInfo>)[editFieldName]!;
        /** 被引用的模型的 id 列定义 */
        const refIdField = findIdField(modelMeta.state.value!, field.type as string)!;

        if (isDataModelField(field)) {
          const relationData = editRow[editFieldName] as RelationSelectData;
          editRow[editFieldName] = {
            connect: relationData.add.map((item) => ({
              [refIdField.name]: item.value,
            })),
            disconnect: relationData.remove.map((item) => ({
              [refIdField.name]: item.value,
            })),
          };
        }
      });
      console.log('[editRow]', editRow);
      const modelKey = selectModelMeta.value!.modelKey;
      const modelName = exportGetModelDbName(modelKey as ModelMetaNames);
      const modelAPI = getModelAPI(API, modelName);
      const updateRes = await modelAPI.update({
        data: editRow,
        where: {
          [idField.name]: (rawRow as any)[idField.name],
        } as any,
        select: {
          [idField.name]: true,
        } as any,
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
  async function deleteRows(rows: Array<Record<string, any>>) {
    /** 查找一个可以用于更新指定记录的唯一主键字段  */
    const idField = findIdField(modelMeta.state.value!, selectModelName.value);
    if (!idField) return console.error('No ID field found in the model');
    if (rows.length === 0)
      return toast.add({
        variant: 'info',
        summary: 'Warn',
        detail: t('未选中数据'),
        life: 3000,
      });
    const modelKey = selectModelMeta.value!.modelKey;
    const modelName = exportGetModelDbName(modelKey as ModelMetaNames);
    const modelAPI = getModelAPI(API, modelName);
    await modelAPI.deleteMany({
      where: {
        OR: rows.map((row: Record<string, any>) => {
          return {
            // @ts-ignore
            [idField.name]: row[idField.name],
          };
        }),
      },
    } as any);
    toast.add({
      variant: 'info',
      summary: '删除数据',
      detail: '删除数据完毕',
      life: 3000,
    });
    reloadTableData();
  }
  function deleteConfirm(_event: MouseEvent) {
    confirm.require({
      message: '确定删除吗？',
      icon: 'pi pi-exclamation-triangle',
      acceptProps: {
        label: 'Delete！',
        variant: 'danger',
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
