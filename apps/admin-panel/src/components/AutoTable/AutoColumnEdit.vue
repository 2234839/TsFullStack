<style scoped></style>
<template>
  <div class="text-nowrap">
    <template v-if="field.type === 'DateTime'">
      <DatePicker showTime hourFormat="24" v-model="eidtValue" class="w-full" />
    </template>
    <template v-else-if="field.type === 'String'">
      <InputText v-model="eidtValue" class="w-full min-w-28" />
    </template>
    <template v-else>{{ cellData }}</template>
  </div>
</template>
<script setup lang="ts">
  import { InputText } from 'primevue';
  import DatePicker from 'primevue/datepicker';
  import { computed } from 'vue';
  import type { FieldInfo } from './type';

  const props = defineProps<{
    field: FieldInfo;
    row: { [fieldName: string]: any };
  }>();
  const cellData = computed(() => props.row[props.field.name]);

  const eidtModel = defineModel<any>();

  /** 双向绑定，但当值未修改时，不更新 eidtModel  */
  const eidtValue = computed({
    get: () => {
      return eidtModel.value ?? cellData.value;
    },
    set: (value) => {
      if (cellData.value !== value) {
        eidtModel.value = value;
      }
    },
  });
</script>
