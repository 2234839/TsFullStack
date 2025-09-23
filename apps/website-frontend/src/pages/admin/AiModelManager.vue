<template>
  <div class="p-4 space-y-4">
    <!-- 页面标题和操作按钮 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 dark:text-white">{{ $t('AI模型管理') }}</h1>
        <p class="text-gray-600 dark:text-gray-400">{{ $t('管理和配置AI模型') }}</p>
      </div>
      <div class="flex gap-2">
        <Button
          :label="$t('添加模型')"
          icon="pi pi-plus"
          @click="showAddModel"
          class="p-button-primary" />
        <Button
          :label="$t('刷新数据')"
          icon="pi pi-refresh"
          @click="loadModels"
          :loading="isLoading"
          class="p-button-outlined" />
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-gray-200 dark:border-slate-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ $t('总模型数') }}</p>
            <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ totalModels }}</p>
          </div>
          <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
            <i class="pi pi-microchip text-blue-600 dark:text-blue-400 text-xl"></i>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-gray-200 dark:border-slate-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ $t('启用模型') }}</p>
            <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ enabledModels }}</p>
          </div>
          <div class="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
            <i class="pi pi-check-circle text-green-600 dark:text-green-400 text-xl"></i>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-gray-200 dark:border-slate-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ $t('禁用模型') }}</p>
            <p class="text-2xl font-bold text-red-600 dark:text-red-400">{{ disabledModels }}</p>
          </div>
          <div class="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
            <i class="pi pi-times-circle text-red-600 dark:text-red-400 text-xl"></i>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-gray-200 dark:border-slate-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ $t('总权重') }}</p>
            <p class="text-2xl font-bold text-purple-600 dark:text-purple-400">{{ totalWeight }}</p>
          </div>
          <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
            <i class="pi pi-balance-scale text-purple-600 dark:text-purple-400 text-xl"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- 模型统计图表 -->
    <div class="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold text-gray-800 dark:text-white">{{ t('模型使用统计') }}</h2>
        <Button
          :label="$t('刷新统计')"
          icon="pi pi-refresh"
          @click="refreshStats"
          :loading="isStatsLoading"
          class="p-button-outlined p-button-sm" />
      </div>
      <ModelStatsChart ref="modelStatsChartRef" />
    </div>

    <!-- 搜索和筛选区域 -->
    <div class="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('搜索模型') }}
          </label>
          <InputText
            v-model="searchQuery"
            :placeholder="$t('输入模型名称或标识')"
            class="w-full"
            @input="handleSearch" />
        </div>

        <div class="field">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('状态筛选') }}
          </label>
          <Select
            v-model="statusFilter"
            :options="statusOptions"
            optionLabel="label"
            optionValue="value"
            :placeholder="$t('选择状态')"
            class="w-full"
            @change="handleFilterChange" />
        </div>

        <div class="field">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('排序方式') }}
          </label>
          <Select
            v-model="sortBy"
            :options="sortOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
            @change="handleFilterChange" />
        </div>
      </div>
    </div>

    <!-- AI模型表格 -->
    <div class="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700">
      <DataTable
        :value="filteredModels"
        :loading="isLoading"
        :paginator="true"
        :rows="10"
        :rowsPerPageOptions="[10, 20, 50]"
        dataKey="id"
        class="p-datatable-sm">

        <Column field="id" :header="$t('ID')" style="width: 80px"></Column>

        <Column field="name" :header="$t('模型名称')" style="min-width: 150px"></Column>

        <Column field="model" :header="$t('模型标识')" style="min-width: 150px">
          <template #body="slotProps">
            <code class="text-sm bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
              {{ slotProps.data.model }}
            </code>
          </template>
        </Column>

        <Column field="baseUrl" :header="$t('API地址')" style="min-width: 200px">
          <template #body="slotProps">
            <div class="text-sm text-gray-600 dark:text-gray-400 truncate" :title="slotProps.data.baseUrl">
              {{ slotProps.data.baseUrl }}
            </div>
          </template>
        </Column>

        <Column field="enabled" :header="$t('状态')" style="width: 100px">
          <template #body="slotProps">
            <Badge
              v-if="slotProps.data.enabled"
              :value="$t('启用')"
              severity="success"
              size="small" />
            <Badge
              v-else
              :value="$t('禁用')"
              severity="danger"
              size="small" />
          </template>
        </Column>

        <Column field="weight" :header="$t('权重')" style="width: 80px">
          <template #body="slotProps">
            <span class="font-mono">{{ slotProps.data.weight }}</span>
          </template>
        </Column>

        <Column field="maxTokens" :header="$t('最大Token')" style="width: 100px">
          <template #body="slotProps">
            <span class="font-mono">{{ slotProps.data.maxTokens?.toLocaleString() || '2000' }}</span>
          </template>
        </Column>

        <Column field="temperature" :header="$t('温度')" style="width: 80px">
          <template #body="slotProps">
            <span class="font-mono">{{ slotProps.data.temperature || 0.7 }}</span>
          </template>
        </Column>

        <Column :header="$t('操作')" style="width: 150px">
          <template #body="slotProps">
            <div class="flex gap-1">
              <Button
                icon="pi pi-edit"
                size="small"
                @click="editModel(slotProps.data)"
                class="p-button-text p-button-sm"
                :title="$t('编辑')" />
              <Button
                icon="pi pi-play"
                size="small"
                @click="toggleModelStatus(slotProps.data)"
                :class="slotProps.data.enabled ? 'p-button-warning' : 'p-button-success'"
                class="p-button-sm"
                :title="slotProps.data.enabled ? $t('禁用') : $t('启用')" />
              <Button
                icon="pi pi-trash"
                size="small"
                @click="deleteModel(slotProps.data)"
                class="p-button-text p-button-sm p-button-danger"
                :title="$t('删除')" />
            </div>
          </template>
        </Column>

      </DataTable>
    </div>
  </div>

  <!-- 添加/编辑模型表单 -->
  <AiModelForm
    v-model:visible="modelFormVisible"
    :model="selectedModel"
    @submit="onModelSubmit" />
</template>

<script setup lang="ts">
import { useAPI } from '@/api';
import { authInfo } from '@/storage';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button, Badge, DataTable, Column, Select, InputText } from 'primevue';
import AiModelForm from './components/AiModelForm.vue';
import ModelStatsChart from './components/ModelStatsChart.vue';

const { API } = useAPI();
const { t } = useI18n();

// 响应式数据
type AiModelType = Awaited<ReturnType<typeof API.db.aiModel.findFirst>>;
const models = ref([] as AiModelType[]);
const isLoading = ref(false);
const isAdmin = ref(false);
const modelFormVisible = ref(false);
const selectedModel = ref<AiModelType | null>(null);
const isStatsLoading = ref(false);
const modelStatsChartRef = ref<InstanceType<typeof ModelStatsChart> | null>(null);

// 搜索和筛选
const searchQuery = ref<string>('');
const statusFilter = ref<boolean | null>(null);
const sortBy = ref<string>('id-desc');

// 选项数据
const statusOptions = ref([
  { label: '全部', value: null },
  { label: '启用', value: true },
  { label: '禁用', value: false }
] as Array<{ label: string; value: boolean | null }>);

const sortOptions = ref([
  { label: 'ID (升序)', value: 'id-asc' },
  { label: 'ID (降序)', value: 'id-desc' },
  { label: '名称 (升序)', value: 'name-asc' },
  { label: '名称 (降序)', value: 'name-desc' },
  { label: '权重 (升序)', value: 'weight-asc' },
  { label: '权重 (降序)', value: 'weight-desc' }
] as Array<{ label: string; value: string }>);

// 计算属性
const totalModels = computed(() => models.value.length);
const enabledModels = computed(() => models.value.filter(model => model?.enabled).length);
const disabledModels = computed(() => models.value.filter(model => !model?.enabled).length);
const totalWeight = computed(() => models.value.reduce((sum, model) => sum + (model?.weight || 0), 0));

// 过滤和排序后的模型列表
const filteredModels = computed(() => {
  let filtered = [...models.value];

  // 搜索过滤
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(model =>
      model?.name?.toLowerCase().includes(query) ||
      model?.model?.toLowerCase().includes(query)
    );
  }

  // 状态过滤
  if (statusFilter.value !== null) {
    filtered = filtered.filter(model => model?.enabled === statusFilter.value);
  }

  // 排序
  const [field, order] = sortBy.value.split('-');
  filtered.sort((a, b) => {
    if (!a || !b) return 0;
    const aValue = a[field as keyof AiModelType] as string | number;
    const bValue = b[field as keyof AiModelType] as string | number;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return order === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return order === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  return filtered;
});

// 加载AI模型数据
const loadModels = async () => {
  isLoading.value = true;
  try {
    const result = await API.db.aiModel.findMany({
      orderBy: { id: 'desc' }
    });
    models.value = result;
  } catch (error) {
    console.error('加载AI模型失败:', (error as Error).message);
    alert(t('加载失败：') + ((error as Error).message || t('未知错误')));
  } finally {
    isLoading.value = false;
  }
};

// 显示添加模型表单
const showAddModel = () => {
  selectedModel.value = null;
  modelFormVisible.value = true;
};

// 编辑模型
const editModel = (model: AiModelType) => {
  selectedModel.value = model;
  modelFormVisible.value = true;
};

// 切换模型状态
const toggleModelStatus = async (model: AiModelType) => {
  if (!model || !confirm(t('确定要{0}这个模型吗？', model.enabled ? t('禁用') : t('启用')))) {
    return;
  }

  try {
    await API.db.aiModel.update({
      where: { id: model.id },
      data: { enabled: !model.enabled }
    });

    alert(t('{0}成功', model.enabled ? t('禁用') : t('启用')));
    await loadModels(); // 重新加载数据
  } catch (error) {
    console.error('切换模型状态失败:', (error as Error).message);
    alert(t('操作失败：') + ((error as Error).message || t('未知错误')));
  }
};

// 删除模型
const deleteModel = async (model: AiModelType) => {
  if (!model || !confirm(t('确定要删除这个模型吗？此操作不可恢复。'))) {
    return;
  }

  try {
    await API.db.aiModel.delete({
      where: { id: model.id }
    });

    alert(t('删除成功'));
    await loadModels(); // 重新加载数据
  } catch (error) {
    console.error('删除模型失败:', (error as Error).message);
    alert(t('删除失败：') + ((error as Error).message || t('未知错误')));
  }
};

// 模型表单提交
const onModelSubmit = async () => {
  await loadModels(); // 重新加载数据
};

// 搜索处理
const handleSearch = () => {
  // 搜索是实时响应的，不需要额外处理
};

// 筛选变化处理
const handleFilterChange = () => {
  // 筛选是实时响应的，不需要额外处理
};

// 刷新统计数据
const refreshStats = async () => {
  if (!modelStatsChartRef.value) return;

  isStatsLoading.value = true;
  try {
    await modelStatsChartRef.value.loadRequestStats();
  } catch (error) {
    console.error('刷新统计数据失败:', error);
    alert(t('刷新统计数据失败：') + ((error as Error).message || t('未知错误')));
  } finally {
    isStatsLoading.value = false;
  }
};

// 检查管理员权限
const checkAdminPermission = () => {
  try {
    if (authInfo.value && authInfo.value.user) {
      // 假设 role 可能是一个数组，检查是否包含 admin
      const userRole = authInfo.value.user.role;
      isAdmin.value = Array.isArray(userRole)
        ? userRole.some(role => role.name === 'admin')
        : userRole === 'admin';
    }
  } catch (error) {
    console.error('检查权限失败:', (error as Error).message);
  }
};

// 页面加载时获取数据
onMounted(async () => {
  checkAdminPermission();
  await loadModels();
});
</script>

<style scoped></style>