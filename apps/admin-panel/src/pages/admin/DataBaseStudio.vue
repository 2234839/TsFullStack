<style scoped></style>
<template>
  <div>
    <div class="flex gap-1">
      <SelectButton
        v-model="selectModelName"
        :options="Object.values(modelMeta.state.value?.models ?? {}).map((el) => el.name)" />
      <Button
        icon="pi pi-refresh"
        @click="modelMeta.execute()"
        :loading="modelMeta.isLoading.value"
        title="更新表格元数据" />
    </div>
    <AutoTable v-if="selectModelName" v-bind:model-name="selectModelName" />
  </div>
</template>
<script setup lang="ts">
  import AutoTable from '@/components/AutoTable/AutoTable.vue';
  import { useModelMeta } from '@/components/AutoTable/util';
  import { SelectButton, Button } from 'primevue';
  import { ref } from 'vue';

  const modelMeta = useModelMeta();

  const selectModelName = ref<string>('User');
</script>
