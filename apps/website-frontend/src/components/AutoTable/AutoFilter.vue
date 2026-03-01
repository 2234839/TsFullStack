<template>
  <div
    class="filter-container p-3 border-b border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('筛选条件') }}</h3>
      <div class="flex space-x-2">
        <Button
          v-if="filters.length > 0"
          icon="pi pi-filter-slash"
          variant="secondary"
          text
          size="small"
          @click="clearAllFilters"
          :tooltip="t('清除所有筛选')" />
        <Button
          icon="pi pi-plus"
          variant="secondary"
          text
          size="small"
          @click="addFilter"
          :tooltip="t('添加筛选条件')" />
      </div>
    </div>

    <TransitionGroup name="filter-list" tag="div" class="space-y-2">
      <div
        v-for="(filter, index) in filters"
        :key="filter.id"
        class="filter-row flex items-center space-x-2 p-2 rounded-lg bg-white dark:bg-gray-900 shadow-sm">
        <Select
          v-model="filter.field"
          :options="availableFieldsOptions"
          :placeholder="t('选择字段')"
          class="w-1/4"
          @update:model-value="updateOperators(filter)" />

        <Select
          v-model="filter.operator"
          :options="getOperatorsForField(filter.field)"
          :placeholder="t('选择操作符')"
          class="w-1/4"
          :disabled="!filter.field" />

        <!-- 使用AutoColumn组件进行值编辑 -->
        <div class="w-1/3" v-if="filter.field">
          <AutoColumnEdit
            v-if="getFieldByName(filter.field)"
            :row="filter.value"
            :field="getFieldByName(filter.field)!"
            :cellData="undefined"
            v-model="filter.value" />
        </div>
        <div class="w-1/3" v-else>
          <Input disabled :placeholder="t('请先选择字段')" class="w-full" />
        </div>

        <Button
          icon="pi pi-times"
          variant="danger"
          text
          size="small"
          @click="removeFilter(index)"
          class="ml-auto" />
      </div>
    </TransitionGroup>

    <div v-if="filters.length > 0" class="mt-3 flex justify-end space-x-2">
      <Button variant="secondary" size="small" @click="clearAllFilters">
        {{ t('重置') }}
      </Button>
      <Button variant="primary" size="small" @click="applyFilters">
        {{ t('应用筛选') }}
      </Button>
    </div>

    <div
      v-if="filters.length === 0"
      class="py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
      {{ t('点击“添加筛选条件”按钮开始筛选数据') }}
    </div>
  </div>
</template>

<script setup lang="ts">
  import AutoColumnEdit from '@/components/AutoTable/AutoColumnEdit.vue';
  import Button from '@/components/base/Button.vue';
  import Input from '@/components/base/Input.vue';
  import { Select } from '@tsfullstack/shared-frontend/components';
  import type { SelectOption } from '@tsfullstack/shared-frontend/components';
  import { computed, ref } from 'vue';
  import { useI18n } from 'vue-i18n';
  import type { FieldInfo } from './type';
  import { isDataModelField } from './type';

  const { t } = useI18n();

  const props = defineProps({
    modelFields: {
      type: Object,
      required: true,
    },
  });

  const emit = defineEmits(['filter']);

  // 可用字段列表
  const availableFieldsOptions = computed<SelectOption[]>(() => {
    return Object.values(props.modelFields)
      .filter((field: FieldInfo) => {
        // 排除关系字段等不适合筛选的字段
        return (
          !isDataModelField(field) &&
          ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Decimal', 'BigInt'].includes(field.type as string)
        );
      })
      .map((field: FieldInfo) => ({
        value: field.name,
        label: field.name,
      }));
  });

  // 获取字段对象（通过字段名）
  const getFieldByName = (fieldName: string | null): FieldInfo | null => {
    if (!fieldName) return null;
    return Object.values(props.modelFields).find((field: FieldInfo) => field.name === fieldName) || null;
  };

  // 筛选条件列表
  const filters = ref<
    Array<{
      id: string;
      field: string | null;
      operator: string | null;
      value: any;
    }>
  >([]);

  // 添加筛选条件
  function addFilter() {
    filters.value.push({
      id: Date.now().toString(), // 使用时间戳作为唯一ID
      field: null,
      operator: null,
      value: null,
    });
  }

  // 移除筛选条件
  function removeFilter(index: number) {
    filters.value.splice(index, 1);
  }

  // 清除所有筛选条件
  function clearAllFilters() {
    filters.value = [];
    emit('filter', {});
  }

  // 根据字段类型获取可用的操作符
  const getOperatorsForField = (fieldName: string | null): SelectOption[] => {
    const commonOperators: SelectOption[] = [
      { value: 'equals', label: t('等于') },
      { value: 'not', label: t('不等于') },
    ];

    const field = getFieldByName(fieldName);
    if (!field) return [];

    // 使用 as string 避免 TypeScript 的类型收窄问题
    switch (field.type as string) {
      case 'String':
        return [
          ...commonOperators,
          { value: 'contains', label: t('包含') },
          { value: 'startsWith', label: t('开头是') },
          { value: 'endsWith', label: t('结尾是') },
          { value: 'in', label: t('在列表中') },
          { value: 'notIn', label: t('不在列表中') },
        ];
      case 'Int':
      case 'Float':
      case 'Decimal':
      case 'BigInt':
        return [
          ...commonOperators,
          { value: 'lt', label: t('小于') },
          { value: 'lte', label: t('小于等于') },
          { value: 'gt', label: t('大于') },
          { value: 'gte', label: t('大于等于') },
          { value: 'in', label: t('在列表中') },
          { value: 'notIn', label: t('不在列表中') },
        ];
      case 'DateTime':
        return [
          ...commonOperators,
          { value: 'lt', label: t('早于') },
          { value: 'lte', label: t('早于等于') },
          { value: 'gt', label: t('晚于') },
          { value: 'gte', label: t('晚于等于') },
        ];
      case 'Boolean':
        return commonOperators;
      default:
        return commonOperators;
    }
  };

  // 更新操作符列表
  function updateOperators(filter: any) {
    filter.operator = null;
    filter.value = null;
  }

  // 应用筛选条件
  function applyFilters() {
    const prismaFilter: Record<string, any> = {};

    // 构建Prisma查询条件
    filters.value.forEach((filter) => {
      if (!filter.field || !filter.operator || filter.value === null || filter.value === undefined)
        return;

      const field = getFieldByName(filter.field);
      if (!field) return;

      const fieldName = field.name;
      const operator = filter.operator;
      let value = filter.value;

      // Convert value to the correct type based on the field type
      if (field.type === 'Int' as string) {
        value = parseInt(value);
      } else if (field.type === 'Float' as string || field.type === 'Decimal' as string) {
        value = parseFloat(value);
      } else if (field.type === 'Boolean' as string) {
        value = value === 'true' || value === true; // Handle string or boolean
      }

      // 处理特殊操作符
      if (operator === 'in' || operator === 'notIn') {
        // 将逗号分隔的字符串转换为数组
        let arrayValue;
        if (typeof value === 'string') {
          arrayValue = value.split(',').map((v) => v.trim());
          // Convert array values to the correct type
          if (field.type === 'Int' as string) {
            arrayValue = arrayValue.map((v) => parseInt(v));
          } else if (field.type === 'Float' as string || field.type === 'Decimal' as string) {
            arrayValue = arrayValue.map((v) => parseFloat(v));
          }
        } else if (Array.isArray(value)) {
          arrayValue = value;
        } else {
          arrayValue = [value];
        }

        if (!prismaFilter[fieldName]) prismaFilter[fieldName] = {};
        prismaFilter[fieldName][operator] = arrayValue;
      } else if (operator === 'not') {
        if (!prismaFilter[fieldName]) prismaFilter[fieldName] = {};
        prismaFilter[fieldName]['not'] = { equals: value };
      } else {
        if (!prismaFilter[fieldName]) prismaFilter[fieldName] = {};
        prismaFilter[fieldName][operator] = value;
      }
    });

    // 发送筛选条件
    emit('filter', prismaFilter);
  }

  // 导出方法供父组件调用
  defineExpose({
    clearAllFilters,
    applyFilters,
  });
</script>

<style scoped>
  .filter-list-enter-active,
  .filter-list-leave-active {
    transition: all 0.3s ease;
  }
  .filter-list-enter-from,
  .filter-list-leave-to {
    opacity: 0;
    transform: translateY(-10px);
  }
</style>
