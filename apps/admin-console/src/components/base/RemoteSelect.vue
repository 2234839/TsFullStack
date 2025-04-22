<template>
  <div @click="handleSearch($event)" class="flex gap-1">
    <span>{{ $t('选择') }}</span>
    <Tag
      v-for="item of modelValue"
      class="group"
      :value="item?.label ?? item?.value"
      severity="info"
      rounded>
      <template #icon>
        <i
          class="hidden! group-hover:block! pi pi-times ml-1 text-xs cursor-pointer"
          @click.stop="removeItem(item)"></i>
      </template>
    </Tag>
  </div>
  <Popover ref="__op">
    <InputText v-model="searchText" class="w-full" />
    <div class="flex items-center p-2">
      <Checkbox :model-value="isAllSelected" binary @update:model-value="toggleSelectAll" />
      <span class="ml-2">{{ $t('全选') }}</span>
    </div>
    <div class="max-h-60 overflow-y-auto">
      <div v-if="loading" class="p-4 text-center">{{ $t('加载中...') }}</div>
      <div
        v-else
        v-for="item in dataList"
        class="p-2 cursor-pointer flex items-center"
        @click.capture.stop.prevent="handleSelect(item)">
        <Checkbox :model-value="modelValue.some((el) => itemEquals(el, item))" binary />
        <span class="ml-2">{{ item.label }}</span>
      </div>
    </div>
    <Paginator
      :first="pagination.skip"
      :rows="pagination.take"
      :totalRecords="pagination.total"
      :loading="loading"
      @page="handlePageChange" />
  </Popover>
</template>
<script setup lang="ts">
  import { computed, ref, useTemplateRef } from 'vue';
  import { InputText, Checkbox, Paginator, Popover, type PageState, Tag } from 'primevue';

  interface SelectItem {
    value: any;
    label: string;
  }

  interface Pagination {
    skip: number;
    take: number;
    total: number;
  }

  const props = defineProps<{
    queryMethod: (params: { keyword: string; skip: number; take: number }) => Promise<{
      data: SelectItem[];
      total: number;
    }>;
  }>();
  const modelValue = defineModel<SelectItem[]>({
    required: true,
  });
  const op = useTemplateRef('__op');
  const searchText = ref('');
  const loading = ref(false);
  const dataList = ref<SelectItem[]>([]);

  const pagination = ref<Pagination>({
    skip: 0,
    take: 10,
    total: 0,
  });

  const handleSearch = async (event: MouseEvent) => {
    pagination.value.skip = 0;
    op.value?.toggle(event);
    await fetchData();
  };

  const handlePageChange = async (event: PageState) => {
    console.log('[event]', event);
    pagination.value.skip = event.first;
    await fetchData();
  };

  const fetchData = async () => {
    loading.value = true;
    try {
      const res = await props.queryMethod({
        keyword: searchText.value,
        skip: pagination.value.skip,
        take: pagination.value.take,
      });
      dataList.value = res.data;
      pagination.value.total = res.total;
    } finally {
      loading.value = false;
    }
  };
  /** 因为数据会分页加载，所以直接按引用判断不行。要按值判断 */
  function itemEquals(a: SelectItem, b: SelectItem) {
    return a.value === b.value;
  }
  const handleSelect = (item: SelectItem) => {
    const index = modelValue.value.findIndex((v) => itemEquals(v, item));
    if (index === -1) {
      modelValue.value.push(item);
    } else {
      removeItem(item);
    }
  };

  const isAllSelected = computed(() => {
    return (
      dataList.value.length > 0 &&
      dataList.value.every((item) => modelValue.value.find((el) => itemEquals(el, item)))
    );
  });

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      dataList.value.forEach((item) => {
        if (!modelValue.value.every((el) => itemEquals(el, item))) {
          modelValue.value.push(item.value);
        }
      });
    } else {
      dataList.value.forEach((item) => removeItem(item));
    }
  };

  const removeItem = (item: SelectItem) => {
    const index = modelValue.value.findIndex((el) => itemEquals(el, item));
    if (index !== -1) {
      modelValue.value.splice(index, 1);
    }
  };
</script>

<style scoped></style>
