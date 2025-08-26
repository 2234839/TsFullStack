<template>
  <div class="min-w-[600px]">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">规则管理</h1>
        <p class="text-gray-600">管理您的自动化任务规则</p>
      </div>
      <div class="flex gap-2">
        <Button
          icon="pi pi-refresh"
          @click="loadRules"
          :loading="loading"
          severity="secondary"
          size="small" />
        <Button icon="pi pi-plus" @click="showCreateDialog = true" label="新建规则" />
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="bg-white p-4 rounded-lg shadow-sm border">
        <div class="text-2xl font-bold text-blue-600">{{ stats.total }}</div>
        <div class="text-sm text-gray-600">总规则数</div>
      </div>
      <div class="bg-white p-4 rounded-lg shadow-sm border">
        <div class="text-2xl font-bold text-green-600">{{ stats.active }}</div>
        <div class="text-sm text-gray-600">激活中</div>
      </div>
      <div class="bg-white p-4 rounded-lg shadow-sm border">
        <div class="text-2xl font-bold text-yellow-600">{{ stats.paused }}</div>
        <div class="text-sm text-gray-600">已暂停</div>
      </div>
      <div class="bg-white p-4 rounded-lg shadow-sm border">
        <div class="text-2xl font-bold text-purple-600">{{ stats.totalExecutions }}</div>
        <div class="text-sm text-gray-600">总执行次数</div>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="bg-white p-4 rounded-lg shadow-sm border mb-6">
      <div class="flex flex-wrap gap-4 items-center">
        <div class="flex-1 min-w-64">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="searchQuery"
              placeholder="搜索规则名称或描述..."
              @input="handleSearch" />
          </IconField>
        </div>
        <Select
          v-model="statusFilter"
          :options="statusOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="状态筛选"
          @change="handleFilterChange"
          class="w-40" />
        <Button
          icon="pi pi-filter-slash"
          @click="clearFilters"
          severity="secondary"
          size="small"
          label="清除筛选" />
      </div>
    </div>

    <!-- Rules Table -->
    <div class="bg-white rounded-lg shadow-sm border">
      <DataTable
        :value="rules"
        :loading="loading"
        :paginator="true"
        :rows="pageSize"
        :totalRecords="totalRecords"
        :rowsPerPageOptions="[10, 20, 50]"
        @page="handlePageChange"
        responsiveLayout="scroll"
        stripedRows>
        <Column field="name" header="规则名称" class="min-w-[150px] whitespace-nowrap">
          <template #body="slotProps">
            <div>
              <div class="font-medium">{{ slotProps.data.name }}</div>
              <div class="text-sm text-gray-600">{{ slotProps.data.description }}</div>
            </div>
          </template>
        </Column>

        <Column field="status" header="状态" class="w-[100px] whitespace-nowrap">
          <template #body="slotProps">
            <span :class="['text-xs px-2 py-1 rounded-md ',
              slotProps.data.status === 'active' ? 'bg-green-500 text-white' :
              slotProps.data.status === 'inactive' ? 'bg-gray-500 text-white' :
              'bg-yellow-500 text-white']">
              {{ getStatusText(slotProps.data.status) }}
            </span>
          </template>
        </Column>

        <Column field="cron" header="执行计划" class="w-[120px] whitespace-nowrap">
          <template #body="slotProps">
            <div class="text-sm">
              <div>{{ slotProps.data.cron }}</div>
              <div v-if="slotProps.data.nextExecutionAt" class="text-xs text-gray-500">
                下次: {{ formatDate(slotProps.data.nextExecutionAt) }}
              </div>
            </div>
          </template>
        </Column>

        <Column field="executionCount" header="执行次数" class="w-[80px] whitespace-nowrap">
          <template #body="slotProps">
            <div class="text-center">
              <div class="font-medium">{{ slotProps.data.executionCount }}</div>
              <div v-if="slotProps.data.lastExecutedAt" class="text-xs text-gray-500">
                {{ formatDate(slotProps.data.lastExecutedAt) }}
              </div>
            </div>
          </template>
        </Column>

        <Column field="tags" header="标签" class="w-[150px] whitespace-nowrap">
          <template #body="slotProps">
            <div class="flex flex-wrap">
              <Chip
                v-for="tag in slotProps.data.tags || []"
                :key="tag"
                :label="tag"
                size="small"
                class="text-xs mr-1 mb-1" />
            </div>
          </template>
        </Column>

        <Column field="actions" header="操作" class="w-[200px] whitespace-nowrap">
          <template #body="slotProps">
            <div class="flex gap-1">
              <Button
                v-if="slotProps.data.status === 'inactive'"
                icon="pi pi-play"
                @click="activateRule(slotProps.data)"
                size="small"
                severity="success"
                v-tooltip="'激活'" />
              <Button
                v-if="slotProps.data.status === 'active'"
                icon="pi pi-pause"
                @click="pauseRule(slotProps.data)"
                size="small"
                severity="warning"
                v-tooltip="'暂停'" />
              <Button
                icon="pi pi-edit"
                @click="editRule(slotProps.data)"
                size="small"
                severity="info"
                v-tooltip="'编辑'" />
              <Button
                icon="pi pi-trash"
                @click="confirmDelete(slotProps.data)"
                size="small"
                severity="danger"
                v-tooltip="'删除'" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Create/Edit Rule Dialog -->
    <Dialog
      v-model:visible="showCreateDialog"
      :header="editingRule ? '编辑规则' : '新建规则'"
      modal
      class="max-w-[600px]">
      <div class="flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">规则名称 *</label>
            <InputText
              v-model="ruleForm.name"
              placeholder="输入规则名称"
              :class="{ 'p-invalid': errors.name }" />
            <small v-if="errors.name" class="text-red-500">{{ errors.name }}</small>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">优先级</label>
            <InputNumber v-model="ruleForm.priority" :min="1" :max="10" placeholder="1-10" />
          </div>
        </div>

        <div class="col-span-2">
          <label class="block text-sm font-medium mb-2">规则描述 *</label>
          <Textarea
            v-model="ruleForm.description"
            placeholder="输入规则描述"
            rows="3"
            :class="{ 'p-invalid': errors.description }" />
          <small v-if="errors.description" class="text-red-500">{{ errors.description }}</small>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">Cron 表达式 *</label>
            <InputText
              v-model="ruleForm.cron"
              placeholder="0 9 * * *"
              :class="{ 'p-invalid': errors.cron }" />
            <small v-if="errors.cron" class="text-red-500">{{ errors.cron }}</small>
            <small class="text-gray-500">格式: 分钟 小时 * * * (例如: 0 9 * * * = 每天9点)</small>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">状态</label>
            <Select
              v-model="ruleForm.status"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value" />
          </div>
        </div>

        <div class="col-span-2">
          <label class="block text-sm font-medium mb-2">目标 URL *</label>
          <InputText
            v-model="ruleForm.taskConfig.url"
            placeholder="https://example.com"
            :class="{ 'p-invalid': errors['taskConfig.url'] }" />
          <small v-if="errors['taskConfig.url']" class="text-red-500">{{
            errors['taskConfig.url']
          }}</small>
        </div>

        <div class="col-span-2">
          <label class="block text-sm font-medium mb-2">标签</label>
          <Chips v-model="ruleForm.tags" placeholder="添加标签..." separator="," />
        </div>

        <div class="col-span-2">
          <label class="block text-sm font-medium mb-2">任务配置 (JSON)</label>
          <Textarea
            v-model="taskConfigJson"
            placeholder='{
  "timeout": 30000,
  "dataCollection": [
    { "type": "css", "selector": ".title" }
  ]
}'
            rows="6" />
        </div>
      </div>

      <template #footer>
        <Button label="取消" @click="showCreateDialog = false" severity="secondary" />
        <Button label="保存" @click="saveRule" :loading="saving" />
      </template>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:visible="showDeleteDialog" header="确认删除" modal class="max-w-[600px]">
      <p>确定要删除规则 "{{ selectedRule?.name }}" 吗？此操作无法撤销。</p>

      <template #footer>
        <Button label="取消" @click="showDeleteDialog = false" severity="secondary" />
        <Button label="删除" @click="deleteRule" :loading="deleting" severity="danger" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, watch } from 'vue';
  import { rulesManager } from '@/utils/rulesManager';
  import { format } from 'date-fns';
  import type { Rule } from '@/storage/rulesService';

  // PrimeVue components
  import Button from 'primevue/button';
  import DataTable from 'primevue/datatable';
  import Column from 'primevue/column';
  import Dialog from 'primevue/dialog';
  import InputText from 'primevue/inputtext';
  import Textarea from 'primevue/textarea';
  import InputNumber from 'primevue/inputnumber';
  import Select from 'primevue/select';
  import Chip from 'primevue/chip';
  import Chips from 'primevue/chips';
  import IconField from 'primevue/iconfield';
  import InputIcon from 'primevue/inputicon';

  // State
  const rules = ref<Rule[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const deleting = ref(false);
  const showCreateDialog = ref(false);
  const showDeleteDialog = ref(false);
  const editingRule = ref<Rule | null>(null);
  const selectedRule = ref<Rule | null>(null);

  // Pagination
  const currentPage = ref(1);
  const pageSize = ref(10);
  const totalRecords = ref(0);

  // Search and filters
  const searchQuery = ref('');
  const statusFilter = ref<'active' | 'inactive' | 'paused' | ''>('');

  // Statistics
  const stats = ref({
    total: 0,
    active: 0,
    inactive: 0,
    paused: 0,
    totalExecutions: 0,
  });

  // Form
  const ruleForm = reactive({
    name: '',
    description: '',
    cron: '',
    status: 'active' as 'active' | 'inactive' | 'paused',
    taskConfig: {
      url: '',
      timeout: 30000,
      dataCollection: [],
    },
    tags: [] as string[],
    priority: 1,
  });

  const taskConfigJson = ref('{}');
  const errors = ref<Record<string, string>>({});

  // Options
  const statusOptions = [
    { label: '激活', value: 'active' },
    { label: '未激活', value: 'inactive' },
    { label: '暂停', value: 'paused' },
  ];

  // Computed
  const getStatusText = (status: string) => {
    const option = statusOptions.find((opt) => opt.value === status);
    return option?.label || status;
  };

  const formatDate = (date: Date | string) => {
    return format(new Date(date), 'MM-dd HH:mm');
  };

  // Methods
  const loadRules = async () => {
    loading.value = true;
    try {
      const result = await rulesManager.getRules({
        page: currentPage.value,
        limit: pageSize.value,
        status: statusFilter.value || undefined,
        search: searchQuery.value || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      rules.value = result.rules;
      totalRecords.value = result.total;
    } finally {
      loading.value = false;
    }
  };

  const loadStats = async () => {
    try {
      stats.value = await rulesManager.getRuleStats();
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handlePageChange = (event: any) => {
    currentPage.value = event.page + 1;
    pageSize.value = event.rows;
    loadRules();
  };

  const handleSearch = () => {
    currentPage.value = 1;
    loadRules();
  };

  const handleFilterChange = () => {
    currentPage.value = 1;
    loadRules();
  };

  const clearFilters = () => {
    searchQuery.value = '';
    statusFilter.value = '';
    currentPage.value = 1;
    loadRules();
  };

  const resetForm = () => {
    Object.assign(ruleForm, {
      name: '',
      description: '',
      cron: '',
      status: 'active',
      taskConfig: {
        url: '',
        timeout: 30000,
        dataCollection: [],
      },
      tags: [],
      priority: 1,
    });
    taskConfigJson.value = '{}';
    errors.value = {};
    editingRule.value = null;
  };

  const validateForm = () => {
    errors.value = {};

    if (!ruleForm.name.trim()) {
      errors.value.name = '规则名称不能为空';
    }

    if (!ruleForm.description.trim()) {
      errors.value.description = '规则描述不能为空';
    }

    if (!ruleForm.cron.trim()) {
      errors.value.cron = 'Cron 表达式不能为空';
    }

    if (!ruleForm.taskConfig.url.trim()) {
      errors.value['taskConfig.url'] = '目标 URL 不能为空';
    }

    return Object.keys(errors.value).length === 0;
  };

  const saveRule = async () => {
    if (!validateForm()) return;

    saving.value = true;
    try {
      // Parse task config JSON
      try {
        const parsedConfig = JSON.parse(taskConfigJson.value);
        ruleForm.taskConfig = {
          ...ruleForm.taskConfig,
          ...parsedConfig,
        };
      } catch (error) {
        errors.value['taskConfig'] = '任务配置 JSON 格式错误';
        return;
      }

      const ruleData = { ...ruleForm };

      if (editingRule.value) {
        await rulesManager.updateRule(editingRule.value.id, ruleData);
      } else {
        await rulesManager.createRule(ruleData);
      }

      showCreateDialog.value = false;
      resetForm();
      loadRules();
      loadStats();
    } finally {
      saving.value = false;
    }
  };

  const editRule = (rule: Rule) => {
    editingRule.value = rule;
    Object.assign(ruleForm, {
      name: rule.name,
      description: rule.description,
      cron: rule.cron,
      status: rule.status,
      taskConfig: rule.taskConfig,
      tags: rule.tags || [],
      priority: rule.priority || 1,
    });
    taskConfigJson.value = JSON.stringify(rule.taskConfig, null, 2);
    showCreateDialog.value = true;
  };

  const confirmDelete = (rule: Rule) => {
    selectedRule.value = rule;
    showDeleteDialog.value = true;
  };

  const deleteRule = async () => {
    if (!selectedRule.value) return;

    deleting.value = true;
    try {
      await rulesManager.deleteRule(selectedRule.value.id);
      showDeleteDialog.value = false;
      selectedRule.value = null;
      loadRules();
      loadStats();
    } finally {
      deleting.value = false;
    }
  };

  const activateRule = async (rule: Rule) => {
    try {
      await rulesManager.activateRule(rule.id);
      loadRules();
      loadStats();
    } catch (error) {
      console.error('Failed to activate rule:', error);
    }
  };

  const pauseRule = async (rule: Rule) => {
    try {
      await rulesManager.pauseRule(rule.id);
      loadRules();
      loadStats();
    } catch (error) {
      console.error('Failed to pause rule:', error);
    }
  };

  // Lifecycle
  onMounted(() => {
    loadRules();
    loadStats();
  });

  // Watch for dialog close
  watch(showCreateDialog, (newValue) => {
    if (!newValue) {
      resetForm();
    }
  });

  // Expose methods for parent component
  defineExpose({
    loadRules,
    loadStats,
  });
</script>
