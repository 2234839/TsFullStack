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
    <template v-else>
      <span class="text-red-500 text-sm" v-tooltip.top="`Unsupported field type: ` + field.type">{{
        field.type
      }}</span
      >{{ cellData }}</template
    >
  </div>
</template>
<script setup lang="ts">
  import { InputNumber, InputText } from 'primevue';
  import DatePicker from 'primevue/datepicker';
  import { computed, ref, useTemplateRef } from 'vue';
  import type { FieldInfo } from './type';
  import { onClickOutside } from '@vueuse/core';

  const props = defineProps<{
    field: FieldInfo;
    cellData: any;
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
  /** 实现如果值未修改，点击外部时关闭编辑模式 */
  onClickOutside(editEl, () => {
    if (props.field.type === 'DateTime' && datePickerShow.value) {
      return /** 因为日期选择面板是在不在当前 div 中，所以当用户选择日期的时候先不管点击外部事件，等日期选择面板关闭后再处理点击外部事件 */;
    }
    if (eidtModel.value === undefined) {
      editMode.value = false;
    }
  });
</script>
