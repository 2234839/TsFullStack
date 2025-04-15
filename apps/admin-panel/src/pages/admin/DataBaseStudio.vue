<style scoped></style>
<template>
  <SelectButton
    v-model="selectModelName"
    :options="Object.values(modelMeta.state.value?.models ?? {}).map((el) => el.name)" />
  <AutoTable v-if="selectModelName" v-bind:model-name="selectModelName" />
</template>
<script setup lang="ts">
  import AutoTable from '@/components/AutoTable/AutoTable.vue';
  import { useModelMeta } from '@/components/AutoTable/util';
  import { SelectButton } from 'primevue';
  import { ref } from 'vue';

  const modelMeta = useModelMeta();

  const selectModelName = ref<string>('User');
</script>
