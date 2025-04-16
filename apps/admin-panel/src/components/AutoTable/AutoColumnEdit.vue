<style scoped></style>
<template>
  <div ref="__editEl" class="text-nowrap">
    <template v-if="field.type === 'DateTime'">
      <DatePicker showTime hourFormat="24" v-model="editValue" class="w-full" />
    </template>
    <template v-else-if="field.type === 'String'">
      <InputText v-model="editValue" class="w-full min-w-28" />
    </template>
    <template v-else>{{ cellData }}</template>
  </div>
</template>
<script setup lang="ts">
  import { InputText } from 'primevue';
  import DatePicker from 'primevue/datepicker';
  import { computed, useTemplateRef } from 'vue';
  import type { FieldInfo } from './type';
  import { onClickOutside } from '@vueuse/core';

  const props = defineProps<{
    field: FieldInfo;
    row: { [fieldName: string]: any };
  }>();
  const cellData = computed(() => props.row[props.field.name]);

  const eidtModel = defineModel<any>();

  /** 双向绑定，但当值未修改时，不更新 eidtModel  */
  const editValue = computed({
    get: () => {
      return eidtModel.value ?? cellData.value;
    },
    set: (value) => {
      if (cellData.value !== value) {
        eidtModel.value = value;
      }
    },
  });

  const editEl = useTemplateRef<HTMLElement>('__editEl');
  const editMode = defineModel<boolean>('editMode', { default: false });
  /** 实现如果值未修改，点击外部时关闭编辑模式 */
  onClickOutside(editEl, () => {
    if (editValue.value === undefined) {
      editMode.value = false;
    }
  });
</script>
