<style scoped></style>
<template>
  智能表格
  {{ users.state }}
  <div class="flex space-x-1">
    <div v-for="(model, modelName) of models">
      {{ modelName }}
    </div>
  </div>

  <DataTable :value="[]" tableStyle="min-width: 50rem">
    <Column field="code" header="Code"></Column>
    <Column field="name" header="Name"></Column>
    <Column field="category" header="Category"></Column>
    <Column field="quantity" header="Quantity"></Column>
  </DataTable>

  <div v-for="user of users.state">
    {{ user }}
  </div>
</template>
<script setup lang="ts">
  import { Column, DataTable } from 'primevue';
  import { API } from '../../api';
  import { useAsyncState } from '@vueuse/core';
  import { computed } from 'vue';

  const users = useAsyncState(async () => {
    await API.db.user.create({
      data: {
        email: `test${Date.now()}@example.com`,
        password: 'test',
      },
    });
    return API.db.user.findMany();
  }, undefined);

  const modelMeta = useAsyncState(() => API.system.getModelMeta(), undefined);
  const models = computed<{ [modelName: string]: any }>(() => {
    const meta = modelMeta.state.value;
    if (!meta) return {};
    return meta.models;
  });
</script>
