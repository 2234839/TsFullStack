<style scoped></style>
<template>
  <div ref="__editEl" class="text-nowrap">
    <template v-if="field.type === 'DateTime'">
      <DatePicker
        @show="datePickerShow = true"
        @hide="datePickerShow = false"
        showTime
        hourFormat="24"
        dateFormat="yy/mm/dd"
        v-model="editValue"
        class="w-full" />
    </template>
    <template v-else-if="field.type === 'String'">
      <InputText v-model="editValue" class="w-full min-w-28" />
    </template>
    <template v-else-if="field.type === 'Int'">
      <InputNumber v-model="editValue" class="w-full min-w-28" inputClass="w-full" />
    </template>
    <template v-else-if="field.isDataModel">
      <div class="flex items-center">
        <!-- 关系字段非常特殊，这里做了大量不是很好的操作，以后有好办法了再优化吧 -->
        <div class="border-r pr-1">
          {{ row?._count?.[field.name] }}
        </div>
        <RelationSelect :field="field" :row="row" @change="changeRelation" />
      </div>
    </template>
    <template v-else>
      <span class="text-red-500 text-sm" v-tooltip.top="`Unsupported field type: ` + field.type">
        {{ field.type }}
      </span>
      {{ cellData }}
    </template>
  </div>
</template>
<script setup lang="ts">
  import RelationSelect, {
    type RelationSelectData,
  } from '@/components/AutoTable/RelationSelect.vue';
  import { onClickOutside } from '@vueuse/core';
  import { InputNumber, InputText } from 'primevue';
  import DatePicker from 'primevue/datepicker';
  import { computed, ref, useTemplateRef } from 'vue';
  import { type FieldInfo } from './type';

  const props = defineProps<{
    field: FieldInfo;
    cellData: any;
    row?: { [fieldName: string]: any };
  }>();

  const eidtModel = defineModel<any>();

  const datePickerShow = ref(false);
  /** 双向绑定，但当值未修改时，不更新 eidtModel  */
  const editValue = computed({
    get: () => {
      return eidtModel.value ?? props.cellData;
    },
    set: (value) => {
      if (props.cellData !== value) {
        eidtModel.value = value;
      }
    },
  });

  const editEl = useTemplateRef<HTMLElement>('__editEl');
  const editMode = defineModel<boolean>('editMode', { default: false });

  //#region 关联关系的编辑映射
  function changeRelation(relation: RelationSelectData) {
    editValue.value = relation;
  }
  //#endregion

  /** 实现如果值未修改，点击外部时关闭编辑模式 */
  onClickOutside(editEl, () => {
    if (props.field.type === 'DateTime' && datePickerShow.value) {
      return /** 因为日期选择面板是在不在当前 div 中，所以当用户选择日期的时候先不管点击外部事件，等日期选择面板关闭后再处理点击外部事件 */;
    }
    if (props.field.isDataModel) return;
    if (eidtModel.value === undefined) {
      editMode.value = false;
    }
  });
</script>
