<style scoped>
/* 隐藏滚动条但保留滚动功能 */
.hide-scrollbar {
  scrollbar-width: none;
  /* Firefox */
  -ms-overflow-style: none;
  /* IE and Edge */
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
  /* Chrome, Safari, Opera */
}
</style>
<template>
  <div class="p-2">
    <div v-if="hideSwitch !== 'true'" class="flex gap-1 items-center">
      <div class="flex-1 overflow-x-auto min-h-0 hide-scrollbar" @wheel.prevent="handleWheel">
        <SelectButton v-model="selectModelName"
          :options="Object.values(modelMeta.state.value?.models ?? {}).map((el) => el.name)" />
      </div>
      <Button icon="pi pi-refresh" @click="modelMeta.execute()" :loading="modelMeta.isLoading.value" title="更新表格元数据" />
    </div>
    <AutoTable v-if="selectModelName" v-bind:model-name="selectModelName" />
  </div>
</template>
<script setup lang="ts">
  import AutoTable from '@/components/AutoTable/AutoTable.vue';
  import { useModelMeta } from '@/components/AutoTable/util';
  import Button from '@/components/base/Button.vue';
  import SelectButton from '@/components/base/SelectButton.vue';
  import { ref, watch } from 'vue';
  import { useRouter, useRoute } from 'vue-router';

  const router = useRouter();
  const route = useRoute();

  /** 将垂直滚轮转换为水平滚动 */
  function handleWheel(e: WheelEvent) {
    const target = e.target as HTMLElement;
    if (e.deltaY !== 0) {
      target.parentElement!.scrollLeft += e.deltaY;
    }
  }

  const modelMeta = await useModelMeta();

  const props = defineProps<{
    hideSwitch?: 'true' | 'false';
    modelName?: string;
  }>();

  /** 从路由 query 或 props 中初始化选中的模型名称 */
  const selectModelName = ref<string>((route.query.model as string) || props.modelName || 'User');

  /** 监听模型选择变化，使用 replace 更新路由 query（不生成历史记录） */
  watch(selectModelName, (newValue) => {
    router.replace({
      query: {
        ...route.query,
        model: newValue,
      },
    });
  });
</script>
