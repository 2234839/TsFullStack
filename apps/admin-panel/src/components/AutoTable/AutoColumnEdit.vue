<style scoped></style>
<template>
  <div class="text-nowrap">
    <template v-if="field.type === 'DateTime'">
      <DatePicker showTime hourFormat="24" v-model="cellData" class="w-full" />
    </template>
    <template v-else-if="field.type === 'String'">
      <InputText v-model="cellData" class="w-full" />
    </template>
    <template v-else>{{ cellData }}</template>
  </div>
</template>
<script setup lang="ts">
  import { computed, watchEffect } from 'vue';
  import type { Field } from './type';
  import DatePicker from 'primevue/datepicker';
  import { InputText } from 'primevue';

  const props = defineProps<{
    field: Field;
    row: { [fieldName: string]: any };
  }>();
  const cellData = computed(() => props.row[props.field.name]);

  const eidtValue = defineModel();
  watchEffect(() => {
    eidtValue.value = cellData.value;
  });
</script>
