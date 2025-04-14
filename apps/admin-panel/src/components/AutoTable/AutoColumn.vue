<style scoped></style>
<template>
  <div>
    <template v-if="field.type === 'DateTime'">
      {{ formatDate(cellData, 'YYYY-MM-DD HH:mm:ss') }}
    </template>
    <template v-else>{{ cellData }}</template>
  </div>
</template>
<script setup lang="ts">
  import { computed } from 'vue';
  import type { Field } from './type';
  import { formatDate } from '@vueuse/core';

  const props = defineProps<{
    field: Field;
    row: { [fieldName: string]: any };
  }>();
  const cellData = computed(() => props.row[props.field.name]);
</script>
