<style scoped></style>
<template>
  <div class="flex space-x-1 my-1">
    <div class="flex items-center space-x-2">
      <Button icon="pi pi-plus" @click="openCreateForm" :tooltip="t('新增记录')" />
      <template v-if="editRows.length">
        <Button @click="saveChanges">{{ t('保存修改结果') }}</Button>
        <Button @click="discardChanges" variant="secondary">{{ t('丢弃修改') }}</Button>
        <span>
          {{ t('autoTable.affectedRows', { rows: editRows.length, cells: editCellCount }) }}
        </span>
      </template>
      <Button v-if="selectRows.length" @click="deleteConfirm($event)" variant="danger">
        {{ t('删除') }}( {{ selectRows.length }} )
      </Button>
    </div>
  </div>
  <AutoFilter v-if="selectModelMeta" :modelFields="fieldsToMap(selectModelMeta.model.fields)" @filter="
      (options) => {
        filter = options;
        currentPage = 1;
        reloadTableData();
      }
    " />
  <DataTable :data="tableData.state.value.list" :loading="tableData.isLoading.value" :selectedRowKeys="selectRows"
    @update:selectedRowKeys="selectRows = $event" rowKey="id" size="small" striped bordered selectable
    :columns="tableColumns">
  </DataTable>
  <!-- 分页 -->
  <div class="flex justify-center gap-1 items-center mt-4 text-sm">
    <Paginator
      :page="currentPage - 1"
      :rows="tableData.state.value.count"
      :rowsPerPage="pageSize"
      :show-rows-per-page-options="true"
      @update:page="(page) => onPageChange({ page, first: page * pageSize })"
      @update:rows-per-page="(newSize) => { pageSize = newSize; onPageChange({ page: 0, first: 0 }); }"
    />
    {{ t('总计') }}：{{ tableData.state.value.count }} {{ t('行') }}
  </div>
  <AutoForm v-if="selectModelMeta && modelMeta.state.value" ref="__createFormRef" :modelKey="selectModelMeta.modelKey"
    :modelFields="selectModelMeta.model.fields || {}" :modelMeta="modelMeta.state.value" @created="onRecordCreated()" />
</template>
<script setup lang="ts">
  import { useAPI } from '@/api';
  import AutoFilter from '@/components/AutoTable/AutoFilter.vue';
  import AutoForm from '@/components/AutoTable/AutoForm.vue';
  import type { RelationSelectData } from '@/components/AutoTable/RelationSelect.vue';
  import { useAsyncState } from '@vueuse/core';
  import { useConfirm } from '@/composables/useConfirm';
  import { useToast } from '@/composables/useToast';
  import { computed, h, nextTick, provide, ref, shallowRef, useTemplateRef, watch } from 'vue';
  import { useI18n } from '@/composables/useI18n';
  import { getErrorMessage } from '@/utils/error';
  import AutoColumn from './AutoColumn.vue';
  import { injectModelMetaKey, type ModelMetaNames, type Model, type DynamicQuery, getModelAPI, isDataModelField, isArrayField, getBackLinkFieldName, fieldsToMap } from './type';

  import { findIdField, useModelMeta, getModelDbName as exportGetModelDbName } from './util';
  const { t } = useI18n();
  const confirm = useConfirm();
  const toast = useToast();
  const { API } = useAPI();

  const modelMeta = await useModelMeta();
  const initialMeta = modelMeta.state.value;
  if (!initialMeta) {
    /** 未登录或 API 不可用时提供空 meta，避免 throw 导致 Suspense 崩溃 */
    provide(injectModelMetaKey, { models: {} } as NonNullable<typeof initialMeta>);
  } else {
    provide(injectModelMetaKey, initialMeta);
  }
  const models = computed(() => {
    const meta = modelMeta.state.value;
    return meta?.models ?? {};
  });
  const selectModelName = defineModel<string>('modelName', {
    required: true,
  });
  /**
   * 选中的行键值数组（存储 ID 值，不是完整对象）
   * DataTable 组件的 update:selectedRowKeys 事件只返回 ID 值
   */
  const selectRows = shallowRef<Array<string | number>>([]);

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
  const onPageChange = (event: { page: number; first: number }) => {
    currentPage.value = event.page + 1;
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
  
      const modelFields = fieldsToMap(models[opt.modelKey as ModelMetaNames]?.fields ?? {});
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
    const meta = selectModelMeta.value;
    if (!meta?.modelKey) return;
    tableData.execute(200, {
      modelKey: meta.modelKey,
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
  const editCellCount = computed(() => {
    return editRows.value.reduce((acc, row) => acc + Object.keys(row).length, 0);
  });
  async function saveChanges() {
    if (!selectModelName.value) return;

    try {
      const currentModelMeta = modelMeta.state.value;
      if (!currentModelMeta) return;
      /** 查找一个可以用于更新指定记录的唯一主键字段  */
      const idField = findIdField(currentModelMeta, selectModelName.value);
      if (!idField) return;

      for (const [index, editRowItem] of editData.value.entries()) {
        const rawRow = tableData.state.value.list[index];
        const editRow = { ...editRowItem };
        const editFields = Object.keys(editRow);
        if (editFields.length === 0) continue;

      /** 修改关联字段不能直接修改字段值，需要使用 connect 关联字段的 ID  */
      editFields.forEach((editFieldName) => {
        const field = fieldsToMap(selectModelMeta.value?.model.fields)[editFieldName]!;
        /** 被引用的模型的 id 列定义 */
        const refIdField = findIdField(currentModelMeta, field.type as string)!;

        if (isDataModelField(field)) {
          const relationData = editRow[editFieldName] as RelationSelectData;

          /**
           * 区分关系类型：
           * - 数组关系（一对多/多对多）：使用 connect/disconnect
           * - 单对象关系（多对一）：使用 connect
           *
           * 对于一对多关系（如 User.userData）：
           * - connect 只能关联自由记录（未关联任何用户的记录）
           * - 如果需要转移所有权（将属于用户A的记录转给用户B），需要直接更新被关联模型的user字段
           */
          if (isArrayField(field)) {
            // 一对多或多对多关系
            const connectData = relationData.add.map((item) => ({
              [refIdField.name]: item.value,
            }));
            const disconnectData = relationData.remove.map((item) => ({
              [refIdField.name]: item.value,
            }));

            editRow[editFieldName] = {
              connect: connectData,
              disconnect: disconnectData,
            };
          } else {
            // 多对一关系（单个对象）
            if (relationData?.add && relationData.add.length > 0) {
              // 只连接第一个添加的项
              const firstItem = relationData.add[0];
              if (firstItem) {
                editRow[editFieldName] = {
                  connect: {
                    [refIdField.name]: firstItem.value,
                  },
                };
              }
            } else if (relationData?.remove && relationData.remove.length > 0) {
              // 断开连接
              editRow[editFieldName] = {
                disconnect: true,
              };
            }
          }
        }
      });

      /**
       * 处理关系字段的转移所有权
       *
       * ## 为什么需要转移所有权？
       *
       * ### 场景：一对多关系（User.userData）
       * - `UserData` 有一个必需的 `userId` 字段（NOT NULL）
       * - 一个 `UserData` 记录只能属于一个 `User`
       * - 当你把一个已属于用户 A 的 `UserData` 关联给用户 B 时，需要：
       *   1. 断开与用户 A 的关联
       *   2. 关联到用户 B
       *
       * ### 为什么不能用简单的 connect？
       * - ZenStack 的 `connect` 操作只能关联自由记录（未关联任何用户的记录）
       * - 如果尝试 `connect` 已属于其他用户的记录，会失败：
       *   - 错误：`UNIQUE constraint failed: UserData.userId, UserData.key, UserData.appId`
       *   - 原因：尝试更新 `UserData.userId` 但违反了唯一约束
       *
       * ### 解决方案：直接更新被关联模型
       * - 不在 `User` 这边用 `connect`
       * 而是直接调用 `UserData.update()` 更新其 `user` 关联
       * - 这样可以正确转移所有权
       *
       * ### 示例
       * - 用户 A 拥有 `UserData { id: 1, userId: 'user-a', key: 'prefs' }`
       * - 用户 B 想要拥有这个 `UserData`
       * - 操作：调用 `UserData.update({ where: { id: 1 }, data: { user: { connect: { id: 'user-b' } } } })`
       * - 结果：`UserData.userId` 更新为 `'user-b'`，所有权从用户 A 转移到用户 B
       */
      for (const editFieldName of editFields) {
        const field = fieldsToMap(selectModelMeta.value?.model.fields)[editFieldName]!;

        if (isDataModelField(field) && isArrayField(field)) {
          const relationData = editRow[editFieldName] as RelationSelectData;

          // 安全检查：确保 relationData 和 relationData.add 存在
          if (relationData?.add && relationData.add.length > 0) {
            // 获取被关联模型的 API（如 UserData API）
            const relatedModel = Object.values(currentModelMeta.models).find((m) => m.name === (field.type as string));
            const modelsRecord = currentModelMeta.models as unknown as Record<string, unknown>;
            const relatedModelKey = relatedModel
              ? (Object.keys(modelsRecord).find((k) => modelsRecord[k] === relatedModel) as ModelMetaNames | undefined)
              : undefined;
            if (!relatedModelKey) continue;
            const relatedModelName = exportGetModelDbName(relatedModelKey);
            const relatedAPI = getModelAPI(API, relatedModelName);
            const relatedIdField = findIdField(currentModelMeta, field.type as string)!;

            // 获取反向字段名称（如 UserData.user）
            const backLinkFieldName = getBackLinkFieldName(field);

            // 找到当前记录的 ID（如 User.id）
            const currentRecordId = (rawRow as Record<string, unknown>)[idField.name];

            // 安全检查：确保 backLinkFieldName 存在
            if (!backLinkFieldName) {
              continue;
            }

            // 更新每个要关联的记录，将它们的 user 关联指向当前记录
            for (const item of relationData.add) {
              try {
                // 获取反向关系的外键字段名（如 UserData.user -> userId）
                const relatedModelForLink = Object.values(currentModelMeta.models).find(
                  (m) => m.name === (field.type as string),
                );
                const backLinkField = relatedModelForLink
                  ? fieldsToMap(relatedModelForLink.fields)[backLinkFieldName]
                  : undefined;
                const foreignKeyField = backLinkField?.relation?.fields?.[0];

                if (!foreignKeyField) {
                  continue;
                }

                // 直接更新外键字段，而不是使用 connect 操作
                // 这样可以避免 UNIQUE 约束冲突问题
                await relatedAPI.update({
                  where: {
                    [relatedIdField.name]: item.value,
                  } as never,
                  data: {
                    [foreignKeyField]: currentRecordId,
                  } as never,
                });
              } catch (error: unknown) {
                // 在 UI 上显示错误提示
                toast.error(
                  t('关联失败'),
                  t(`无法将 ${field.type} 记录转移到当前用户：该记录可能与目标用户的现有记录冲突（唯一约束）`),
                );

                // 如果转移失败（可能因为唯一约束），从 editRow 中移除这个 connect
                if (editRow[editFieldName]?.connect) {
                  const connectData = editRow[editFieldName].connect ?? [];
                  editRow[editFieldName].connect = connectData.filter(
                    (conn: any) => conn[relatedIdField.name] !== item.value
                  );
                }
              }
            }

            // 清空 editRow 中的 connect，因为我们已经手动处理了
            if (editRow[editFieldName]) {
              editRow[editFieldName].connect = [];
            }
          }
        }
      }

      const currentMeta = selectModelMeta.value;
      if (!currentMeta?.modelKey) return;
      const modelKey = currentMeta.modelKey;
      const modelName = exportGetModelDbName(modelKey as ModelMetaNames);
      const modelAPI = getModelAPI(API, modelName);
      await modelAPI.update({
        data: editRow,
        where: {
          [idField.name]: (rawRow as Record<string, unknown>)[idField.name],
        } as DynamicQuery,
        select: {
          [idField.name]: true,
        } as DynamicQuery,
      });
    }
    reloadTableData();
    } catch (error: unknown) {
      // 在 UI 上显示错误提示
      toast.error(
        t('保存失败'),
        getErrorMessage(error, t('保存更改时发生错误，请查看控制台了解详情')),
      );
    }
  }
  function discardChanges() {
    editRows.value.forEach((row) => {
      Object.keys(row).forEach((key) => {
        delete row[key];
      });
    });
  }
  async function deleteRows(rows: Array<Record<string, any> | string | number>) {
    const deleteModelMeta = modelMeta.state.value;
    if (!deleteModelMeta) return;
    /** 查找一个可以用于更新指定记录的唯一主键字段  */
    const idField = findIdField(deleteModelMeta, selectModelName.value);
    if (!idField) return;
    if (rows.length === 0)
      return toast.info(t('警告'), t('未选中数据'));
    const deleteMeta = selectModelMeta.value;
    if (!deleteMeta?.modelKey) return;
    const modelKey = deleteMeta.modelKey;
    const modelName = exportGetModelDbName(modelKey as ModelMetaNames);
    const modelAPI = getModelAPI(API, modelName);

    /**
     * 提取 ID 值
     * rows 可能是：ID 数组 [1, 2, 3] 或对象数组 [{id: 1}, {id: 2}, {id: 3}]
     */
    const ids = rows.map((row) => {
      // 如果是对象，取 idField 对应的值
      if (typeof row === 'object' && row !== null) {
        return row[idField.name];
      }
      // 如果已经是 ID 值，直接返回
      return row;
    });

    /**
     * 过滤掉无效的 ID（null、undefined）
     * 防止 { id: null } 导致删除全部数据
     */
    const validIds = ids.filter((id) => id != null);

    if (validIds.length === 0) {
      return toast.warn(t('删除失败'), t('选中的数据没有有效的 ID'));
    }

    try {
      await modelAPI.deleteMany({
        where: {
          OR: validIds.map((id) => ({
            [idField.name]: id,
          })),
        } as DynamicQuery,
      });

      // 删除成功后清空选中状态并刷新表格
      selectRows.value = [];
      reloadTableData();

      toast.success(t('删除数据'), t(`成功删除 ${validIds.length} 条数据`));
    } catch (error: unknown) {
      // 提取错误信息并显示给用户
      const errorMessage = getErrorMessage(error);

      // 解析 FOREIGN KEY 约束错误，给出更友好的提示
      let userMessage = errorMessage;
      if (errorMessage.includes('FOREIGN KEY constraint failed')) {
        userMessage = t('无法删除：该数据被其他记录引用，请先删除关联数据');
      } 

      toast.error(t('删除失败'), userMessage);

      // 错误已通过 toast 通知用户
    }
  }
  function deleteConfirm(event: MouseEvent) {
    confirm.require({
      message: t('确定删除吗？'),
      icon: 'pi pi-exclamation-triangle',
      event,
      acceptProps: {
        label: t('删除'),
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
