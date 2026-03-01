<template>
  <Dropdown v-model="dropdownOpen" @open="handleSearch">
    <template #trigger>
      <div
        class="flex gap-1 items-center p-2 rounded-md cursor-pointer hotransition-colors min-h-10">
        <span class="bg-primary-600 dark:bg-primary-700 rounded-sm px-1 text-white">{{
          t('选择')
        }}</span>
        <div class="flex flex-wrap gap-1">
          <template v-if="showTag">
            <Tag
              v-for="item of modelValue"
              class="group transition-all"
              :value="item?.label ?? item?.value"
              variant="info"
              rounded>
              <template #icon>
                <i
                  :class="[
                    'pi',
                    'pi-times',
                    'ml-1',
                    'text-xs',
                    'cursor-pointer',
                    'hover:text-danger-500',
                    { 'hidden!': !isTagHovered(item) },
                  ]"
                  @mouseover="setTagHovered(item, true)"
                  @mouseleave="setTagHovered(item, false)"
                  @click.stop="remove(item)"></i>
              </template> </Tag
          ></template>
        </div>
        <i class="pi pi-chevron-down ml-auto text-gray-500 dark:text-gray-400"></i>
      </div>
    </template>
    <div class="remote-select-dropdown">
      <div class="p-3">
        <Input
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
        <span class="ml-2 font-medium">{{ t('全选') }}</span>
      </div>
      <ScrollArea style="height: 250px;">
          <div v-if="loading" class="p-4 text-center">
            <i class="pi pi-spin pi-spinner mr-2"></i>
            {{ t('加载中...') }}
          </div>
          <div
            v-else
            v-for="item in dataList"
            :key="item.value"
            class="p-3 cursor-pointer flex items-center transition-colors"
            :class="{
              'hover:bg-primary-50 dark:hover:bg-primary-950': !isItemDisabled(item),
              'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800': isItemDisabled(item)
            }"
            @click.capture.stop.prevent="handleSelect(item)">
            <Checkbox
              :model-value="modelValue.some((el) => itemEquals(el, item))"
              :binary="true"
              :disabled="isItemDisabled(item)" />
            <span class="ml-2" :class="{ 'text-gray-500 dark:text-gray-400': isItemDisabled(item) }">
              {{ item.label }}
            </span>
            <span v-if="isItemDisabled(item)" class="ml-auto text-xs text-gray-400 dark:text-gray-500">
              {{ t('必需') }}
            </span>
          </div>
          <div v-if="dataList.length === 0 && !loading" class="p-4 text-center text-gray-500 dark:text-gray-400">
            {{ t('无数据') }}
          </div>
      </ScrollArea>
      <div class="p-3 border-t border-gray-200 dark:border-gray-600">
        <Paginator
          :rows="pagination.total"
          :rowsPerPage="pagination.take"
          :page="currentPage"
          :disabled="loading"
          @update:page="handlePageChange" />
      </div>
    </div>
  </Dropdown>
</template>
<script lang="ts">
  export interface RemoteSelectItem {
    value: any;
    label: string;
  }

  function addItem(items: RemoteSelectItem[], item: RemoteSelectItem) {
    if (!items.some((el) => el.value === item.value)) {
      items.push(item);
    }
  }
  function removeItem(items: RemoteSelectItem[], item: RemoteSelectItem) {
    const index = items.findIndex((el) => itemEquals(el, item));
    if (index !== -1) {
      items.splice(index, 1);
    }
  }
  /** 因为数据会分页加载，所以直接按引用判断不行。要按值判断 */
  function itemEquals(a: RemoteSelectItem, b: RemoteSelectItem) {
    return a.value === b.value;
  }
  export const RemoteSelectUtils = {
    addItem,
    removeItem,
    itemEquals,
  };
</script>
<script setup lang="ts">
  import { Dropdown, ScrollArea } from '@tsfullstack/shared-frontend/components';
  import { Checkbox, Input, Paginator, Tag } from '@/components/base';
  import { computed, ref } from 'vue';
  import { useI18n } from '@/composables/useI18n';

  /** 获取 t 函数 */
  const { t } = useI18n();

  interface Pagination {
    skip: number;
    take: number;
    total: number;
  }

  const props = defineProps({
    queryMethod: {
      type: null as unknown as () => (params: {
        keyword: string;
        skip: number;
        take: number;
      }) => Promise<{
        data: RemoteSelectItem[];
        total: number;
      }>,
      required: true,
    },
    showTag: {
      type: Boolean,
      default: true,
    },
    /** 禁用的项列表（不能取消选择的项） */
    disabledItems: {
      type: Array as () => RemoteSelectItem[],
      default: () => [],
    },
  });

  const emit = defineEmits<{
    add: [value: RemoteSelectItem];
    remove: [value: RemoteSelectItem];
  }>();

  const modelValue = defineModel<RemoteSelectItem[]>({
    required: true,
  });
  const searchText = ref('');
  const loading = ref(false);
  const dataList = ref<RemoteSelectItem[]>([]);
  const tagHovered = ref<Record<any, boolean>>({});
  const dropdownOpen = ref(false);

  const pagination = ref<Pagination>({
    skip: 0,
    take: 10,
    total: 0,
  });

  /** 当前页码（从0开始） */
  const currentPage = computed(() => {
    return Math.floor(pagination.value.skip / pagination.value.take);
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

  const handlePageChange = async (page: number) => {
    pagination.value.skip = page * pagination.value.take;
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

  const handleSelect = (item: RemoteSelectItem) => {
    // 如果项被禁用，不允许操作
    if (isItemDisabled(item)) {
      return;
    }

    const index = modelValue.value.findIndex((v) => itemEquals(v, item));
    if (index === -1) {
      add(item);
    } else {
      remove(item);
    }
  };

  const isAllSelected = computed(() => {
    return (
      dataList.value.length > 0 &&
      dataList.value.every((item) =>
        modelValue.value.find((el) => RemoteSelectUtils.itemEquals(el, item)),
      )
    );
  });

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      dataList.value.forEach((item) => {
        add(item);
      });
    } else {
      dataList.value.forEach((item) => remove(item));
    }
  };

  const remove = (item: RemoteSelectItem) => {
    emit('remove', item);
    RemoteSelectUtils.removeItem(modelValue.value, item);
    tagHovered.value[item.value] = false;
  };
  const add = (item: RemoteSelectItem) => {
    emit('add', item);
    RemoteSelectUtils.addItem(modelValue.value, item);
  };

  const isTagHovered = (item: RemoteSelectItem) => {
    return tagHovered.value[item.value] || false;
  };

  const setTagHovered = (item: RemoteSelectItem, hovered: boolean) => {
    tagHovered.value[item.value] = hovered;
  };

  /** 判断某个项是否被禁用（不可取消） */
  const isItemDisabled = (item: RemoteSelectItem) => {
    return props.disabledItems.some((disabledItem) => itemEquals(disabledItem, item));
  };
</script>

<style scoped>
.remote-select-dropdown {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
</style>
