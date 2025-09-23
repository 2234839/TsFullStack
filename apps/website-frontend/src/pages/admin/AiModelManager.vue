<style scoped></style>
<template>
  <div class="p-4 space-y-4">
    <!-- 页面标题和操作按钮 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 dark:text-white">{{ $t('AI模型管理') }}</h1>
        <p class="text-gray-600 dark:text-gray-400">{{ $t('管理系统配置的AI模型，支持多提供商负载均衡') }}</p>
      </div>
      <div class="flex gap-2">
        <Button
          :label="$t('新增模型')"
          icon="pi pi-plus"
          @click="openCreateDialog"
          class="p-button-primary" />
        <Button
          :label="$t('清理限制记录')"
          icon="pi pi-trash"
          @click="cleanupRateLimits"
          :loading="isCleaning"
          class="p-button-secondary" />
      </div>
    </div>

    <!-- 模型统计卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-gray-200 dark:border-slate-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ $t('总模型数') }}</p>
            <p class="text-2xl font-bold text-gray-800 dark:text-white">{{ models.length }}</p>
          </div>
          <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
            <i class="pi pi-server text-blue-600 dark:text-blue-400 text-xl"></i>
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
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ $t('总权重') }}</p>
            <p class="text-2xl font-bold text-purple-600 dark:text-purple-400">{{ totalWeight }}</p>
          </div>
          <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
            <i class="pi pi-balance-scale text-purple-600 dark:text-purple-400 text-xl"></i>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-gray-200 dark:border-slate-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ $t('提供商数') }}</p>
            <p class="text-2xl font-bold text-orange-600 dark:text-orange-400">{{ uniqueProviders }}</p>
          </div>
          <div class="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
            <i class="pi pi-globe text-orange-600 dark:text-orange-400 text-xl"></i>
          </div>
        </div>
      </div>
    </div>

  <!-- 模型请求量图表 -->
    <div class="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">{{ $t('模型请求量统计') }}</h2>
        <div class="flex gap-2">
          <SelectButton
            v-model="chartTimeRange"
            :options="timeRangeOptions"
            optionLabel="label"
            optionValue="value"
            size="small" />
          <Button
            :label="$t('刷新数据')"
            icon="pi pi-refresh"
            @click="refreshStats"
            :loading="isLoadingStats"
            size="small"
            class="p-button-outlined" />
        </div>
      </div>

      <ModelStatsChart ref="modelStatsChartRef" />
    </div>

    <!-- 模型列表表格 -->
    <div class="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700">
      <DataTable
        :value="models"
        :loading="isLoading"
        :paginator="true"
        :rows="10"
        :rowsPerPageOptions="[10, 20, 50]"
        dataKey="id"
        class="p-datatable-sm">

        <Column field="id" :header="$t('ID')" style="width: 80px"></Column>

        <Column field="name" :header="$t('名称')" style="min-width: 150px">
          <template #body="slotProps">
            <div class="flex items-center gap-2">
              <span>{{ slotProps.data.name }}</span>
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
            </div>
          </template>
        </Column>

        <Column field="model" :header="$t('模型标识')" style="min-width: 120px"></Column>

        <Column field="baseUrl" :header="$t('API地址')" style="min-width: 200px">
          <template #body="slotProps">
            <div class="text-sm text-gray-600 dark:text-gray-400 truncate" :title="slotProps.data.baseUrl">
              {{ slotProps.data.baseUrl }}
            </div>
          </template>
        </Column>

        <Column field="weight" :header="$t('权重')" style="width: 100px">
          <template #body="slotProps">
            <Badge :value="slotProps.data.weight" severity="info" />
          </template>
        </Column>

        <Column :header="$t('限制配置')" style="width: 150px">
          <template #body="slotProps">
            <div class="text-xs space-y-1">
              <div>{{ $t('每分钟') }}: {{ slotProps.data.rpmLimit }}</div>
              <div>{{ $t('每小时') }}: {{ slotProps.data.rphLimit }}</div>
              <div>{{ $t('每日') }}: {{ slotProps.data.rpdLimit }}</div>
            </div>
          </template>
        </Column>

        <Column field="description" :header="$t('描述')" style="min-width: 150px">
          <template #body="slotProps">
            <div class="text-sm text-gray-600 dark:text-gray-400 truncate" :title="slotProps.data.description">
              {{ slotProps.data.description || '-' }}
            </div>
          </template>
        </Column>

        <Column :header="$t('操作')" style="width: 150px">
          <template #body="slotProps">
            <div class="flex gap-1">
              <Button
                icon="pi pi-pencil"
                size="small"
                @click="openEditDialog(slotProps.data)"
                class="p-button-text p-button-sm" />
              <Button
                :icon="slotProps.data.enabled ? 'pi pi-eye-slash' : 'pi pi-eye'"
                size="small"
                @click="toggleEnabled(slotProps.data)"
                :class="slotProps.data.enabled ? 'p-button-warning' : 'p-button-success'"
                class="p-button-text p-button-sm" />
              <Button
                icon="pi pi-trash"
                size="small"
                @click="confirmDelete(slotProps.data)"
                class="p-button-danger p-button-text p-button-sm" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- 创建/编辑对话框 -->
    <Dialog
      v-model:visible="dialogVisible"
      :modal="true"
      :header="isEdit ? $t('编辑AI模型') : $t('创建AI模型')"
      class="p-fluid"
      style="max-width: 600px">

      <div class="space-y-4">
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('模型名称') }} *
          </label>
          <InputText
            v-model="formData.name"
            :placeholder="$t('请输入模型名称')"
            class="w-full" />
        </div>

        <div class="field">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('模型标识') }} *
          </label>
          <InputText
            v-model="formData.model"
            :placeholder="$t('例如：gpt-3.5-turbo')"
            class="w-full" />
        </div>

        <div class="field">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('API基础URL') }} *
          </label>
          <InputText
            v-model="formData.baseUrl"
            :placeholder="$t('例如：https://api.openai.com/v1')"
            class="w-full" />
        </div>

        <div class="field">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('API密钥') }} *
          </label>
          <Password
            v-model="formData.apiKey"
            :placeholder="$t('请输入API密钥')"
            :feedback="false"
            toggleMask
            class="w-full" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="field">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('最大Token数') }}
            </label>
            <InputNumber
              v-model="formData.maxTokens"
              :placeholder="$t('默认：2000')"
              class="w-full" />
          </div>

          <div class="field">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('温度参数') }}
            </label>
            <InputNumber
              v-model="formData.temperature"
              :min="0"
              :max="2"
              :step="0.1"
              :placeholder="$t('默认：0.7')"
              class="w-full" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="field">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('权重值') }}
            </label>
            <InputNumber
              v-model="formData.weight"
              :min="1"
              :max="1000"
              :placeholder="$t('默认：100')"
              class="w-full" />
          </div>

          <div class="field">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('启用状态') }}
            </label>
            <ToggleSwitch
              v-model="formData.enabled"
              class="w-full" />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div class="field">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('每分钟限制') }}
            </label>
            <InputNumber
              v-model="formData.rpmLimit"
              :min="1"
              :placeholder="$t('默认：60')"
              class="w-full" />
          </div>

          <div class="field">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('每小时限制') }}
            </label>
            <InputNumber
              v-model="formData.rphLimit"
              :min="1"
              :placeholder="$t('默认：1000')"
              class="w-full" />
          </div>

          <div class="field">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('每日限制') }}
            </label>
            <InputNumber
              v-model="formData.rpdLimit"
              :min="1"
              :placeholder="$t('默认：10000')"
              class="w-full" />
          </div>
        </div>

        <div class="field">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('描述信息') }}
          </label>
          <Textarea
            v-model="formData.description"
            :placeholder="$t('可选的模型描述信息')"
            :rows="3"
            class="w-full" />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            :label="$t('取消')"
            icon="pi pi-times"
            @click="dialogVisible = false"
            class="p-button-text" />
          <Button
            :label="$t('保存')"
            icon="pi pi-check"
            @click="saveModel"
            :loading="isSaving"
            class="p-button-primary" />
        </div>
      </template>
    </Dialog>

    <!-- 删除确认对话框 -->
    <Dialog
      v-model:visible="deleteDialogVisible"
      :modal="true"
      :header="$t('确认删除')"
      class="p-fluid">

      <p>{{ $t('确定要删除AI模型 "{name}" 吗？此操作不可撤销。', { name: selectedModel?.name }) }}</p>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            :label="$t('取消')"
            icon="pi pi-times"
            @click="deleteDialogVisible = false"
            class="p-button-text" />
          <Button
            :label="$t('删除')"
            icon="pi pi-trash"
            @click="deleteModel"
            :loading="isDeleting"
            class="p-button-danger" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { useAPI } from '@/api';
import { Button, InputText, InputNumber, Password, Textarea, ToggleSwitch, Badge, DataTable, Column, Dialog, SelectButton } from 'primevue';
import ModelStatsChart from './components/ModelStatsChart.vue';
import { computed, onMounted, reactive, ref } from 'vue';

const { API } = useAPI();

// 响应式数据
const models = ref<any[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const isDeleting = ref(false);
const isCleaning = ref(false);
const dialogVisible = ref(false);
const deleteDialogVisible = ref(false);
const isEdit = ref(false);
const selectedModel = ref<any>(null);

// 图表相关数据
const modelStatsChartRef = ref();
const isLoadingStats = ref(false);
const chartTimeRange = ref('24h');
const requestStats = ref<any[]>([]);
const timeRangeOptions = ref([
  { label: '24小时', value: '24h' },
  { label: '7天', value: '7d' },
  { label: '30天', value: '30d' }
]);

// 表单数据
const formData = reactive({
  name: '',
  model: '',
  baseUrl: '',
  apiKey: '',
  maxTokens: 2000,
  temperature: 0.7,
  enabled: true,
  weight: 100,
  rpmLimit: 60,
  rphLimit: 1000,
  rpdLimit: 10000,
  description: '',
});

// 计算属性
const enabledModels = computed(() => models.value.filter(m => m.enabled).length);
const totalWeight = computed(() => models.value.reduce((sum, m) => sum + (m.weight || 0), 0));
const uniqueProviders = computed(() => new Set(models.value.map(m => new URL(m.baseUrl).hostname)).size);


// 加载模型列表
const loadModels = async () => {
  isLoading.value = true;
  try {
    const result = await API.aiApi.getAIModels();
    models.value = result;
  } catch (error) {
    console.error('加载AI模型失败:', (error as Error).message);
  } finally {
    isLoading.value = false;
    loadRequestStats(); // 加载统计数据
  }
};

// 打开创建对话框
const openCreateDialog = () => {
  isEdit.value = false;
  Object.assign(formData, {
    name: '',
    model: '',
    baseUrl: '',
    apiKey: '',
    maxTokens: 2000,
    temperature: 0.7,
    enabled: true,
    weight: 100,
    rpmLimit: 60,
    rphLimit: 1000,
    rpdLimit: 10000,
    description: '',
  });
  dialogVisible.value = true;
};

// 打开编辑对话框
const openEditDialog = (model: any) => {
  isEdit.value = true;
  selectedModel.value = model;
  Object.assign(formData, model);
  dialogVisible.value = true;
};

// 保存模型
const saveModel = async () => {
  if (!formData.name || !formData.model || !formData.baseUrl || !formData.apiKey) {
    alert('请填写必填字段');
    return;
  }

  isSaving.value = true;
  try {
    if (isEdit.value) {
      await API.aiApi.updateAIModel({
        id: selectedModel.value.id,
        ...formData,
      });
    } else {
      await API.aiApi.createAIModel(formData);
    }
    dialogVisible.value = false;
    await loadModels();
  } catch (error) {
    console.error('保存AI模型失败:', (error as Error).message);
    alert('保存失败: ' + ((error as Error).message || '未知错误'));
  } finally {
    isSaving.value = false;
  }
};

// 切换启用状态
const toggleEnabled = async (model: any) => {
  try {
    await API.aiApi.updateAIModel({
      id: model.id,
      enabled: !model.enabled,
    });
    await loadModels();
  } catch (error) {
    console.error('切换模型状态失败:', (error as Error).message);
  }
};

// 确认删除
const confirmDelete = (model: any) => {
  selectedModel.value = model;
  deleteDialogVisible.value = true;
};

// 删除模型
const deleteModel = async () => {
  isDeleting.value = true;
  try {
    await API.aiApi.deleteAIModel(selectedModel.value.id);
    deleteDialogVisible.value = false;
    await loadModels();
  } catch (error) {
    console.error('删除AI模型失败:', (error as Error).message);
    alert('删除失败: ' + ((error as Error).message || '未知错误'));
  } finally {
    isDeleting.value = false;
  }
};

// 清理频率限制记录
const cleanupRateLimits = async () => {
  if (!confirm('确定要清理过期的频率限制记录吗？')) {
    return;
  }

  isCleaning.value = true;
  try {
    await API.aiApi.cleanupExpiredRateLimits();
    alert('清理成功');
  } catch (error) {
    console.error('清理频率限制记录失败:', (error as Error).message);
    alert('清理失败: ' + ((error as Error).message || '未知错误'));
  } finally {
    isCleaning.value = false;
  }
};

// 刷新统计数据
const refreshStats = async () => {
  if (modelStatsChartRef.value) {
    isLoadingStats.value = true;
    try {
      await modelStatsChartRef.value.loadRequestStats(chartTimeRange.value);
    } finally {
      isLoadingStats.value = false;
    }
  }
};

// 加载请求统计数据（保留以兼容现有调用）
const loadRequestStats = async () => {
  isLoadingStats.value = true;
  try {
    // 计算时间范围
    const now = new Date();
    let startTime: Date;

    if (chartTimeRange.value === '24h') {
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (chartTimeRange.value === '7d') {
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (chartTimeRange.value === '30d') {
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // 查询 apiRateLimit 表获取统计数据
    const rateLimits = await API.db.apiRateLimit.findMany({
      where: {
        timestamp: {
          gte: startTime
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    // 按模型分组统计数据
    const modelStats = new Map();

    // 先为所有模型初始化统计对象
    models.value.forEach(model => {
      modelStats.set(model.id, {
        modelId: model.id,
        modelName: model.name,
        totalRequests: 0,
        successCount: 0,
        lastRequest: null,
        hourlyData: new Array(24).fill(0), // 24小时数据
        dailyData: new Array(7).fill(0),   // 7天数据
        monthlyData: new Array(30).fill(0) // 30天数据
      });
    });

    // 处理实际数据
    rateLimits.forEach(record => {
      const stats = modelStats.get(record.aiModelId);
      if (!stats) return;

      stats.totalRequests++;

      // 根据是否有用户ID来判断成功（可以根据实际需求调整）
      if (record.userId) {
        stats.successCount++;
      }

      // 更新最后请求时间
      if (!stats.lastRequest || record.timestamp > stats.lastRequest) {
        stats.lastRequest = record.timestamp;
      }

      // 按时间段分组统计（用于趋势图）
      const recordTime = new Date(record.timestamp);
      const hoursDiff = (now.getTime() - recordTime.getTime()) / (1000 * 60 * 60);
      const daysDiff = Math.floor(hoursDiff / 24);

      if (chartTimeRange.value === '24h' && hoursDiff < 24) {
        const hourIndex = Math.floor(hoursDiff);
        if (hourIndex < 24) {
          stats.hourlyData[23 - hourIndex]++; // 最近的在最后
        }
      } else if (chartTimeRange.value === '7d' && daysDiff < 7) {
        stats.dailyData[6 - daysDiff]++; // 最近的在最后
      } else if (chartTimeRange.value === '30d' && daysDiff < 30) {
        stats.monthlyData[29 - daysDiff]++; // 最近的在最后
      }
    });

    // 计算最终统计数据
    requestStats.value = Array.from(modelStats.values()).map(stats => ({
      modelId: stats.modelId,
      modelName: stats.modelName,
      totalRequests: stats.totalRequests,
      successRate: stats.totalRequests > 0 ? stats.successCount / stats.totalRequests : 0,
      avgResponseTime: Math.floor(Math.random() * 1000) + 200, // 临时使用随机数，可根据实际需要调整
      lastRequest: stats.lastRequest,
      trendData: chartTimeRange.value === '24h' ? stats.hourlyData :
                  chartTimeRange.value === '7d' ? stats.dailyData :
                  stats.monthlyData
    }));

  } catch (error) {
    console.error('加载请求统计失败:', (error as Error).message);
    // 出错时使用空数据
    requestStats.value = models.value.map(model => ({
      modelId: model.id,
      modelName: model.name,
      totalRequests: 0,
      successRate: 0,
      avgResponseTime: 0,
      lastRequest: null,
      trendData: new Array(chartTimeRange.value === '24h' ? 24 : chartTimeRange.value === '7d' ? 7 : 30).fill(0)
    }));
  } finally {
    isLoadingStats.value = false;
  }
};



// 页面加载时获取数据
onMounted(() => {
  loadModels();
  loadRequestStats();
});
</script>