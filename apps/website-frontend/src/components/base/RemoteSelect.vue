<template>
  <SmartPopover placement="top">
    <template #trigger>
      <div
        @click="handleSearch()"
        class="flex gap-1 items-center p-2 rounded-md cursor-pointer hotransition-colors min-h-[40px]">
        <span class="bg-blue-300 drak:bg-blue-700 rounded-sm px-1 text-white">{{
          $t('选择')
        }}</span>
        <div class="flex flex-wrap gap-1">
          <Tag
            v-for="item of modelValue"
            class="group transition-all"
            :value="item?.label ?? item?.value"
            severity="info"
            rounded>
            <template #icon>
              <i
                :class="[
                  'pi',
                  'pi-times',
                  'ml-1',
                  'text-xs',
                  'cursor-pointer',
                  'hover:text-red-500',
                  { 'hidden!': !isTagHovered(item) },
                ]"
                @mouseover="setTagHovered(item, true)"
                @mouseleave="setTagHovered(item, false)"
                @click.stop="removeItem(item)"></i>
            </template>
          </Tag>
        </div>
        <i class="pi pi-chevron-down ml-auto text-gray-500"></i>
      </div>
    </template>
    <div class="p-3">
      <InputText
        v-model="searchText"
        class="w-full"
        placeholder="搜索..."
        @input="debounceSearch" />
    </div>
    <div class="flex items-center p-3">
      <Checkbox
        :model-value="isAllSelected"
        binary
        @update:model-value="toggleSelectAll(!isAllSelected)" />
      <span class="ml-2 font-medium">{{ $t('全选') }}</span>
    </div>
    <div class="max-h-60 overflow-y-auto">
      <div v-if="loading" class="p-4 text-center">
        <i class="pi pi-spin pi-spinner mr-2"></i>
        {{ $t('加载中...') }}
      </div>
      <div
        v-else
        v-for="item in dataList"
        class="p-3 cursor-pointer flex items-center hover:bg-blue-50 transition-colors"
        @click.capture.stop.prevent="handleSelect(item)">
        <Checkbox :model-value="modelValue.some((el) => itemEquals(el, item))" binary />
        <span class="ml-2">{{ item.label }}</span>
      </div>
      <div v-if="dataList.length === 0 && !loading" class="p-4 text-center text-gray-500">
        {{ $t('无数据') }}
      </div>
    </div>
    <div>
      <Paginator
        :first="pagination.skip"
        :rows="pagination.take"
        :totalRecords="pagination.total"
        :loading="loading"
        @page="handlePageChange" />
    </div>
  </SmartPopover>
</template>
<script setup lang="ts">
  import SmartPopover from './SmartPopover.vue';
  import { Checkbox, InputText, Paginator, Tag, type PageState } from 'primevue';
  import { computed, ref } from 'vue';

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
  const searchText = ref('');
  const loading = ref(false);
  const dataList = ref<SelectItem[]>([]);
  const tagHovered = ref<Record<any, boolean>>({});

  const pagination = ref<Pagination>({
    skip: 0,
    take: 10,
    total: 0,
  });

  let searchTimeout: any = null;

  const debounceSearch = () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      pagination.value.skip = 0;
      fetchData();
    }, 300);
  };

  const handleSearch = async () => {
    pagination.value.skip = 0;
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
        if (!modelValue.value.some((el) => itemEquals(el, item))) {
          modelValue.value.push(item);
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
    tagHovered.value[item.value] = false;
  };

  const isTagHovered = (item: SelectItem) => {
    return tagHovered.value[item.value] || false;
  };

  const setTagHovered = (item: SelectItem, hovered: boolean) => {
    tagHovered.value[item.value] = hovered;
  };
</script>

<style scoped></style>
