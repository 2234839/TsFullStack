<style scoped></style>
<template>
  <div class="text-nowrap py-1" @click="editMode = true" v-if="!editMode">
    <template v-if="field.type === 'DateTime'">
      {{ formatDate(cellData, 'YYYY-MM-DD HH:mm:ss') }}
    </template>
    <template v-else>{{ cellData }}</template>
  </div>
  <AutoColumnEdit v-else :field="field" :row="props.row" />
</template>
<script setup lang="ts">
  import { computed, ref } from 'vue';
  import type { Field } from './type';
  import { formatDate } from '@vueuse/core';
  import AutoColumnEdit from './AutoColumnEdit.vue';

  const props = defineProps<{
    field: Field;
    row: { [fieldName: string]: any };
  }>();
  const cellData = computed(() => props.row[props.field.name]);

  const editMode = ref(false);
</script>
