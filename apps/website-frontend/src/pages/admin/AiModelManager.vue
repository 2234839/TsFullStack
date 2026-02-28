<template>
  <div class="p-4 space-y-4">
    <!-- 页面标题和操作按钮 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 dark:text-white">{{ t('AI模型管理') }}</h1>
        <p class="text-gray-600 dark:text-gray-400">{{ t('管理和配置AI模型') }}</p>
      </div>
      <div class="flex gap-2">
        <Button
          :label="t('添加模型')"
          icon="pi pi-plus"
          variant="primary"
          @click="showAddModel" />
        <Button
          :label="t('刷新数据')"
          icon="pi pi-refresh"
          @click="loadModels"
          :loading="isLoading"
          variant="secondary" />
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div
        class="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-gray-200 dark:border-slate-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('总模型数') }}</p>
            <p class="text-2xl font-bold text-primary-600 dark:text-primary-400">{{ totalModels }}</p>
          </div>
          <div
            class="w-12 h-12 bg-primary-100 dark:bg-primary-900/20 rounded-lg flex items-center justify-center">
            <i class="pi pi-microchip text-primary-600 dark:text-primary-400 text-xl"></i>
          </div>
        </div>
      </div>

      <div
        class="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-gray-200 dark:border-slate-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('启用模型') }}</p>
            <p class="text-2xl font-bold text-success-600 dark:text-success-400">{{ enabledModels }}</p>
          </div>
          <div
            class="w-12 h-12 bg-success-100 dark:bg-success-900/20 rounded-lg flex items-center justify-center">
            <i class="pi pi-check-circle text-success-600 dark:text-success-400 text-xl"></i>
          </div>
        </div>
      </div>

      <div
        class="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-gray-200 dark:border-slate-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('禁用模型') }}</p>
            <p class="text-2xl font-bold text-danger-600 dark:text-danger-400">{{ disabledModels }}</p>
          </div>
          <div
            class="w-12 h-12 bg-danger-100 dark:bg-danger-900/20 rounded-lg flex items-center justify-center">
            <i class="pi pi-times-circle text-danger-600 dark:text-danger-400 text-xl"></i>
          </div>
        </div>
      </div>

      <div
        class="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-gray-200 dark:border-slate-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('总权重') }}</p>
            <p class="text-2xl font-bold text-purple-600 dark:text-purple-400">{{ totalWeight }}</p>
          </div>
          <div
            class="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
            <i class="pi pi-balance-scale text-purple-600 dark:text-purple-400 text-xl"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- AI模型表格 -->
    <div
      class="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700">
      <DataTable
        :data="filteredModels"
        :loading="isLoading"
        :columns="aiModelColumns"
        rowKey="id"
        size="small"
        striped
        bordered />
    </div>

    <!-- 模型统计图表 -->
    <div
      class="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold text-gray-800 dark:text-white">{{ t('模型使用统计') }}</h2>
        <Button
          :label="t('刷新统计')"
          icon="pi pi-refresh"
          @click="refreshStats"
          :loading="isStatsLoading"
          variant="secondary"
          size="small" />
      </div>
      <ModelStatsChart ref="modelStatsChartRef" />
    </div>
  </div>

  <!-- 添加/编辑模型表单 -->
  <AiModelForm v-model:visible="modelFormVisible" :model="selectedModel" @submit="onModelSubmit" />
</template>

<script setup lang="ts">
  import { useAPI } from '@/api';
  import { computed, onMounted, ref } from 'vue';
  import { useI18n } from '@/composables/useI18n';
  import { Button, Badge, DataTable } from '@/components/base';
  import { useConfirm } from '@/composables/useConfirm';
  import { useToast } from '@/composables/useToast';
  import AiModelForm from './components/AiModelForm.vue';
  import ModelStatsChart from './components/ModelStatsChart.vue';
  import { h } from 'vue';

  const { API } = useAPI();
  const { t } = useI18n();
  const confirm = useConfirm();
  const toast = useToast();

  // 响应式数据
  type AiModelType = Awaited<ReturnType<typeof API.db.aiModel.findFirst>>;
  const models = ref([] as AiModelType[]);
  const isLoading = ref(false);
  const modelFormVisible = ref(false);
  const selectedModel = ref<AiModelType | null>(null);
  const isStatsLoading = ref(false);
  const modelStatsChartRef = ref<InstanceType<typeof ModelStatsChart> | null>(null);

  // 搜索和筛选
  const searchQuery = ref<string>('');
  const statusFilter = ref<boolean | null>(null);
  const sortBy = ref<string>('id-desc');

  // 计算属性
  const totalModels = computed(() => models.value.length);
  const enabledModels = computed(() => models.value.filter((model) => model?.enabled).length);
  const disabledModels = computed(() => models.value.filter((model) => !model?.enabled).length);
  const totalWeight = computed(() =>
    models.value.reduce((sum, model) => sum + (model?.weight || 0), 0),
  );

  // 过滤和排序后的模型列表
  const filteredModels = computed(() => {
    let filtered = [...models.value];

    // 搜索过滤
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter(
        (model) =>
          model?.name?.toLowerCase().includes(query) || model?.model?.toLowerCase().includes(query),
      );
    }

    // 状态过滤
    if (statusFilter.value !== null) {
      filtered = filtered.filter((model) => model?.enabled === statusFilter.value);
    }

    // 排序
    const [field, order] = sortBy.value.split('-');
    filtered.sort((a, b) => {
      if (!a || !b) return 0;
      const aValue = a[field as keyof AiModelType] as string | number;
      const bValue = b[field as keyof AiModelType] as string | number;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return order === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return order === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return filtered;
  });

  // 表格列定义
  const aiModelColumns = computed(() => [
    {
      key: 'id',
      title: t('ID'),
      width: '80px',
    },
    {
      key: 'name',
      title: t('模型名称'),
      width: '150px',
    },
    {
      key: 'model',
      title: t('模型标识'),
      width: '150px',
      render: (row: any) =>
        h('code', { class: 'text-sm bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded' }, row.model),
    },
    {
      key: 'baseUrl',
      title: t('API地址'),
      width: '200px',
      render: (row: any) =>
        h('div', { class: 'text-sm text-gray-600 dark:text-gray-400 truncate', title: row.baseUrl }, row.baseUrl),
    },
    {
      key: 'enabled',
      title: t('状态'),
      width: '100px',
      render: (row: any) =>
        h(
          Badge,
          { value: row.enabled ? t('启用') : t('禁用'), variant: row.enabled ? 'success' : 'danger', size: 'small' },
        ),
    },
    {
      key: 'weight',
      title: t('权重'),
      width: '80px',
      render: (row: any) => h('span', { class: 'font-mono' }, row.weight),
    },
    {
      key: 'maxTokens',
      title: t('最大Token'),
      width: '100px',
      render: (row: any) =>
        h('span', { class: 'font-mono' }, (row.maxTokens || 2000).toLocaleString()),
    },
    {
      key: 'temperature',
      title: t('温度'),
      width: '80px',
      render: (row: any) => h('span', { class: 'font-mono' }, row.temperature || 0.7),
    },
    {
      key: 'actions',
      title: t('操作'),
      width: '150px',
      render: (row: any) =>
        h('div', { class: 'flex gap-1' }, [
          h(Button, {
            icon: 'pi pi-pencil',
            size: 'small',
            onClick: () => editModel(row),
            title: t('编辑'),
          }),
          h(Button, {
            icon: 'pi pi-play',
            size: 'small',
            variant: row.enabled ? 'danger' : 'primary',
            onClick: () => toggleModelStatus(row),
            title: row.enabled ? t('禁用') : t('启用'),
          }),
          h(Button, {
            icon: 'pi pi-trash',
            size: 'small',
            variant: 'danger',
            onClick: () => deleteModel(row),
            title: t('删除'),
          }),
        ]),
    },
  ]);

  // 加载AI模型数据
  const loadModels = async () => {
    isLoading.value = true;
    try {
      const result = await API.db.aiModel.findMany({
        orderBy: { id: 'desc' },
      });
      models.value = result;
    } catch (error) {
      console.error('加载AI模型失败:', (error as Error).message);
      toast.add({
        variant: 'error',
        summary: t('失败'),
        detail: t('加载失败：') + ((error as Error).message || t('未知错误')),
        life: 3000,
      });
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
  const toggleModelStatus = (model: AiModelType) => {
    if (!model) return;

    confirm.require({
      message: t('确定要{0}这个模型吗？', model.enabled ? t('禁用') : t('启用')),
      icon: 'pi pi-exclamation-triangle',
      rejectProps: {
        label: t('取消'),
        variant: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: model.enabled ? t('禁用') : t('启用'),
        variant: model.enabled ? 'danger' : 'primary',
      },
      accept: async () => {
        try {
          await API.db.aiModel.update({
            where: { id: model.id },
            data: { enabled: !model.enabled },
          });

          toast.add({
            variant: 'success',
            summary: t('成功'),
            detail: t('{0}成功', model.enabled ? t('禁用') : t('启用')),
            life: 3000,
          });
          await loadModels(); // 重新加载数据
        } catch (error) {
          console.error('切换模型状态失败:', (error as Error).message);
          toast.add({
            variant: 'error',
            summary: t('失败'),
            detail: t('操作失败：') + ((error as Error).message || t('未知错误')),
            life: 3000,
          });
        }
      },
      reject: () => {
        // 用户取消操作
      }
    });
  };

  // 删除模型
  const deleteModel = (model: AiModelType) => {
    if (!model) return;

    confirm.require({
      message: t('确定要删除这个模型吗？此操作不可恢复。'),
      icon: 'pi pi-exclamation-triangle',
      rejectProps: {
        label: t('取消'),
        variant: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: t('删除'),
        variant: 'danger',
      },
      accept: async () => {
        try {
          await API.db.aiModel.delete({
            where: { id: model.id },
          });

          toast.add({
            variant: 'success',
            summary: t('成功'),
            detail: t('删除成功'),
            life: 3000,
          });
          await loadModels(); // 重新加载数据
        } catch (error) {
          console.error('删除模型失败:', (error as Error).message);
          toast.add({
            variant: 'error',
            summary: t('失败'),
            detail: t('删除失败：') + ((error as Error).message || t('未知错误')),
            life: 3000,
          });
        }
      },
      reject: () => {
        // 用户取消操作
      }
    });
  };

  // 模型表单提交
  const onModelSubmit = async () => {
    await loadModels(); // 重新加载数据
  };

  // 刷新统计数据
  const refreshStats = async () => {
    if (!modelStatsChartRef.value) return;

    isStatsLoading.value = true;
    try {
      await modelStatsChartRef.value.loadRequestStats();
    } catch (error) {
      console.error('刷新统计数据失败:', error);
      toast.add({
        variant: 'error',
        summary: t('失败'),
        detail: t('刷新统计数据失败：') + ((error as Error).message || t('未知错误')),
        life: 3000,
      });
    } finally {
      isStatsLoading.value = false;
    }
  };

  // 页面加载时获取数据
  onMounted(async () => {
    await loadModels();
  });
</script>

<style scoped></style>
