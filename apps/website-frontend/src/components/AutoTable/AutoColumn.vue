<style scoped></style>
<template>
  <div class="text-nowrap p-1 min-h-8" @click="editMode = true" v-if="!editMode">
    <template v-if="field.type === 'DateTime'">
      {{ formatDate(cellData, 'YYYY-MM-DD HH:mm:ss') }}
    </template>
    <template v-else-if="field.isDataModel">
      <Tag>
        <template #icon v-if="field.isArray">
          <div class="border-r pr-1">
            {{ cellData.length }}
          </div>
        </template>
        {{ field.type }}
      </Tag>
    </template>
    <template v-else>{{ cellData }}</template>
  </div>
  <AutoColumnEdit
    v-model="editValue"
    v-model:edit-mode="editMode"
    v-else
    :field="field"
    :cellData="props.row[field.name]" />
</template>
<script setup lang="ts">
  import { formatDate } from '@vueuse/core';
  import { Tag } from 'primevue';
  import { computed, ref } from 'vue';
  import AutoColumnEdit from './AutoColumnEdit.vue';
  import type { FieldInfo } from './type';

  const props = defineProps<{
    field: FieldInfo;
    row: { [fieldName: string]: any };
  }>();

  const editValue = defineModel('editValue');
  const cellData = computed(() => props.row[props.field.name]);

  const editMode = ref(false);
</script>
