<style scoped></style>
<template>
  <div>
    <div v-if="hideSwitch !== 'true'" class="flex gap-1">
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
  import { Button, SelectButton } from 'primevue';
  import { ref } from 'vue';

  const modelMeta = await useModelMeta();

  const props = defineProps<{
    hideSwitch?: 'true' | 'false';
    modelName?: string;
  }>();
  const selectModelName = ref<string>(props.modelName ?? 'User');
</script>
