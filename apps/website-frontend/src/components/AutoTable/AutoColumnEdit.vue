<style scoped></style>
<template>
  <div ref="__editEl" class="text-nowrap">
    <template v-if="fieldType === 'DateTime'">
      <DatePicker
        @show="datePickerShow = true"
        @hide="datePickerShow = false"
        showTime
        hourFormat="24"
        dateFormat="yy/mm/dd"
        v-model="dateValue"
        class="w-full" />
    </template>
    <template v-else-if="fieldType === 'String'">
      <Input v-model="stringValue" class="w-full min-w-28" />
    </template>
    <template v-else-if="fieldType === 'Int'">
      <InputNumber v-model="numberValue" class="w-full min-w-28" inputClass="w-full" />
    </template>
    <template v-else-if="isRelationField">
      <div class="flex items-center">
        <!-- 关系字段非常特殊，这里做了大量不是很好的操作，以后有好办法了再优化吧 -->
        <div class="border-r pr-1">
          {{ (row?._count as Record<string, number | string> | undefined)?.[String(fieldName) as keyof (Record<string, number | string>)] ?? '' }}
        </div>
        <RelationSelect :field="field" :row="row" @change="(value: unknown) => changeRelation(value as RelationSelectData)" />
      </div>
    </template>
    <template v-else>
      <Tooltip :content="`Unsupported field type: ${fieldType}`" side="top">
        <span class="text-danger-500 dark:text-danger-400 text-sm">
          {{ fieldType }}
        </span>
      </Tooltip>
      {{ cellData }}
    </template>
  </div>
</template>
<script setup lang="ts">
  import RelationSelect, {
    type RelationSelectData,
  } from '@/components/AutoTable/RelationSelect.vue';
  import { onClickOutside } from '@vueuse/core';
  import { Tooltip } from '@tsfullstack/shared-frontend/components';
  import { computed, ref, useTemplateRef } from 'vue';
  import { type FieldInfo, isDataModelField } from './type';

  const { field, cellData, row } = defineProps<{
    field: FieldInfo;
    /** 动态单元格数据 — AutoTable 动态字段系统无法静态确定具体类型 */
    cellData: unknown;
    row?: Record<string, unknown>;
  }>();

  /** editModel 类型与 cellData 一致，动态字段系统无法静态确定 */
  const editModel = defineModel<unknown>();

  const datePickerShow = ref(false);
  /** 双向绑定，但当值未修改时，不更新 editModel  */
  const editValue = computed({
    get: () => {
      return editModel.value ?? cellData;
    },
    set: (value) => {
      if (cellData !== value) {
        editModel.value = value;
      }
    },
  });

  /** 日期字段绑定值 */
  const dateValue = computed<Date | string | null>({
    get: () => editValue.value instanceof Date || typeof editValue.value === 'string' ? editValue.value : null,
    set: (v) => { editValue.value = v; },
  });
  /** 字符串字段绑定值 */
  const stringValue = computed<string>({
    get: () => typeof editValue.value === 'string' ? editValue.value : String(editValue.value ?? ''),
    set: (v) => { editValue.value = v; },
  });
  /** 数值字段绑定值 */
  const numberValue = computed<number | undefined>({
    get: () => typeof editValue.value === 'number' ? editValue.value : undefined,
    set: (v) => { editValue.value = v; },
  });

  const editEl = useTemplateRef<HTMLElement>('__editEl');
  const editMode = defineModel<boolean>('editMode', { default: false });

  // 模板辅助属性，避免类型推断问题
  const fieldType = computed<string>(() => field.type);
  const fieldName = computed<string>(() => field.name);
  const isRelationField = computed(() => isDataModelField(field));

  //#region 关联关系的编辑映射
  function changeRelation(relation: RelationSelectData) {
    editValue.value = relation;
  }
  //#endregion

  /** 实现如果值未修改，点击外部时关闭编辑模式 */
  onClickOutside(editEl, () => {
    if (field.type === 'DateTime' && datePickerShow.value) {
      return /** 因为日期选择面板是在不在当前 div 中，所以当用户选择日期的时候先不管点击外部事件，等日期选择面板关闭后再处理点击外部事件 */;
    }
    if (isDataModelField(field)) return;
    if (editModel.value === undefined) {
      editMode.value = false;
    }
  });
</script>
