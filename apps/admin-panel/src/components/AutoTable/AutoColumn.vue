<style scoped></style>
<template>
  <div class="text-nowrap p-1" @click="editMode = true" v-if="!editMode">
    <template v-if="field.type === 'DateTime'">
      {{ formatDate(cellData, 'YYYY-MM-DD HH:mm:ss') }}
    </template>
    <template v-else>{{ cellData }}</template>
  </div>
  <AutoColumnEdit ref="__editEl" v-model="editValue" v-else :field="field" :row="props.row" />
</template>
<script setup lang="ts">
  import { computed, ref, useTemplateRef } from 'vue';
  import type { Field } from './type';
  import { formatDate, onClickOutside } from '@vueuse/core';
  import AutoColumnEdit from './AutoColumnEdit.vue';

  const props = defineProps<{
    field: Field;
    row: { [fieldName: string]: any };
  }>();

  const editValue = defineModel('editValue');
  const cellData = computed(() => props.row[props.field.name]);

  const editMode = ref(false);
  const editEl = useTemplateRef<HTMLElement>('__editEl');

  /** 实现如果值未修改，点击外部时关闭编辑模式 */
  onClickOutside(editEl, () => {
    if (editValue.value === undefined) {
      editMode.value = false;
    }
  });
</script>
