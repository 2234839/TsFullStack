<style scoped></style>
<template>
  <div class="text-nowrap p-1 min-h-8" @click="editMode = true" v-if="!editMode" key="display">
    <template v-if="field.type === 'DateTime'">
      {{ cellData instanceof Date ? formatDate(cellData) : '-' }}
    </template>
    <template v-else-if="'relation' in field">
      <Tag>
        <template #icon>
          <div v-if="isRelationArray" class="border-r pr-1">
            {{ relationCount }}
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
    key="edit"
    :field="field"
    :row="row"
    :cellData="row[field.name]"
  />
</template>
<script setup lang="ts">
import { formatDate } from '@/utils/format';
import { computed, ref } from 'vue';
import AutoColumnEdit from './AutoColumnEdit.vue';
import type { FieldInfo } from './type';
import { isArrayField } from './type';

const { field, row } = defineProps<{
  field: FieldInfo;
  row: Record<string, unknown>;
}>();

const editValue = defineModel<unknown>('editValue');
const cellData = computed(() => row[field.name]);
const isRelationArray = computed(() => isArrayField(field));

/** 关系数组字段的关联计数（_count 聚合，动态字段系统无法静态确定） */
const relationCount = computed(() => (row._count as Record<string, unknown> | undefined)?.[field.name] ?? '');

const editMode = ref(false);
</script>
