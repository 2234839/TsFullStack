<style scoped></style>
<template>
  <div class="text-nowrap p-1 min-h-8" @click="editMode = true" v-if="!editMode">
    <template v-if="field.type === 'DateTime'">
      {{ cellData ? formatDate(cellData, 'YYYY-MM-DD HH:mm:ss') : '-' }}
    </template>
    <template v-else-if="'relation' in field">
      <Tag>
        <template #icon v-if="isRelationArray">
          <div class="border-r pr-1">
            {{ row._count[field.name] }}
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
    :row="row"
    :cellData="props.row[field.name]" />
</template>
<script setup lang="ts">
  import { formatDate } from '@vueuse/core';
  import Tag from '@/components/base/Tag.vue';
  import { computed, ref } from 'vue';
  import AutoColumnEdit from './AutoColumnEdit.vue';
  import type { FieldInfo } from './type';
  import { isArrayField } from './type';

  const props = defineProps<{
    field: FieldInfo;
    row: { [fieldName: string]: any };
  }>();

  const editValue = defineModel('editValue');
  const cellData = computed(() => props.row[props.field.name]);
  const isRelationArray = computed(() => isArrayField(props.field));

  const editMode = ref(false);
</script>
