<template>
  <div>
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

    <!-- 规则表格 -->
    <div class="bg-white p-2 rounded-lg shadow-sm">
      <!-- Search and Filters -->
      <div>
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
      <div>
        <DataTable
          :value="rules"
          :loading="loading"
          :paginator="true"
          :rows="pageSize"
          :totalRecords="totalRecords"
          :rowsPerPageOptions="[10, 20, 50]"
          :lazy="true"
          @page="handlePageChange"
          responsiveLayout="scroll"
          v-model:expandedRows="expandedRows"
          dataKey="id"
          :rowStyle="getRowStyle">
          <Column :expander="true" headerStyle="width: 3rem" />
          <Column field="name" header="规则名称" class="min-w-[150px] whitespace-nowrap">
            <template #body="slotProps">
              <div class="flex items-center gap-2">
                <div
                  v-if="hasUnreadExecutions(slotProps.data.id)"
                  class="w-2 h-2 rounded-full bg-blue-500"
                  title="有未读的执行记录"></div>
                <div>
                  <div class="font-medium">{{ slotProps.data.name }}</div>
                  <div class="text-sm text-gray-600">{{ slotProps.data.description }}</div>
                </div>
              </div>
            </template>
          </Column>

          <Column field="status" header="状态" class="w-[100px] whitespace-nowrap">
            <template #body="slotProps">
              <span
                :class="[
                  'text-xs px-2 py-1 rounded-md ',
                  slotProps.data.status === 'active'
                    ? 'bg-green-500 text-white'
                    : slotProps.data.status === 'inactive'
                    ? 'bg-gray-500 text-white'
                    : 'bg-yellow-500 text-white',
                ]">
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

          <Column field="actions" header="操作" class="w-[280px] whitespace-nowrap">
            <template #body="slotProps">
              <div class="flex gap-1">
                <Button
                  v-if="slotProps.data.status === 'inactive'"
                  icon="pi pi-play"
                  @click="rulesService.activateRule(slotProps.data)"
                  size="small"
                  severity="success"
                  v-tooltip="'激活'" />
                <Button
                  v-if="slotProps.data.status === 'active'"
                  icon="pi pi-pause"
                  @click="rulesService.pauseRule(slotProps.data)"
                  size="small"
                  severity="warning"
                  v-tooltip="'暂停'" />
                <Button
                  icon="pi pi-play-circle"
                  @click="executeRuleNow(slotProps.data)"
                  size="small"
                  severity="primary"
                  v-tooltip="'立即执行'" />
                <Button
                  icon="pi pi-file-edit"
                  @click="editRule(slotProps.data)"
                  size="small"
                  severity="secondary"
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

          <template #expansion="slotProps">
            <RuleExecutionRecords
              :ruleId="slotProps.data.id"
              @read-status-changed="handleReadStatusChanged"
              @all-marked-as-read="handleAllMarkedAsRead" />
          </template>
        </DataTable>
      </div>
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
          <InputChips v-model="ruleForm.tags" placeholder="添加标签..." separator="," typeahead />
        </div>

        <div class="col-span-2">
          <label class="block text-sm font-medium mb-2">数据收集配置</label>

          <!-- Visual Data Collection Configuration -->
          <div class="border rounded-lg p-4 mb-4">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-medium">数据收集项</h3>
              <Button
                icon="pi pi-plus"
                label="添加收集项"
                size="small"
                @click="showAddCollectionDialog" />
            </div>

            <div
              v-if="
                ruleForm.taskConfig.dataCollection && ruleForm.taskConfig.dataCollection.length > 0
              "
              class="space-y-2">
              <div
                v-for="(item, index) in ruleForm.taskConfig.dataCollection"
                :key="index"
                class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span
                      class="px-2 py-1 text-xs rounded-md"
                      :class="
                        item.type === 'css'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      ">
                      {{ item.type === 'css' ? 'CSS' : 'JS' }}
                    </span>
                    <span class="font-medium">
                      {{ item.type === 'css' ? item.selector : 'JavaScript 代码' }}
                    </span>
                    <span
                      v-if="item.type === 'css' && item.attribute"
                      class="text-sm text-gray-500">
                      (属性: {{ item.attribute }})
                    </span>
                  </div>
                </div>
                <div class="flex gap-1">
                  <Button
                    icon="pi pi-file-edit"
                    size="small"
                    severity="info"
                    @click="editCollectionItem(item, index)" />
                  <Button
                    icon="pi pi-trash"
                    size="small"
                    severity="danger"
                    @click="removeCollectionItem(index)" />
                </div>
              </div>
            </div>
            <div v-else class="text-center text-gray-500 py-8">
              暂无数据收集项，点击"添加收集项"开始配置
            </div>
          </div>

          <!-- Advanced JSON Configuration -->
          <Accordion :value="['0']">
            <AccordionPanel value="0">
              <AccordionHeader>高级 JSON 配置</AccordionHeader>
              <AccordionContent>
                <Textarea
                  v-model="taskConfigJson"
                  placeholder='{
  "timeout": 30000,
  "dataCollection": [
    { "type": "css", "selector": ".title" }
  ]
}'
                  rows="6" />
              </AccordionContent>
            </AccordionPanel>
          </Accordion>
        </div>
      </div>

      <template #footer>
        <Button label="取消" @click="showCreateDialog = false" severity="secondary" />
        <Button label="保存" @click="saveRule" :loading="saving" />
      </template>
    </Dialog>

    <!-- Data Collection Item Dialog -->
    <Dialog
      v-model:visible="showDataCollectionDialog"
      :header="editingCollectionItem !== null ? '编辑收集项' : '添加收集项'"
      modal
      class="max-w-[500px]">
      <div class="flex flex-col gap-4">
        <!-- Collection Type Selection -->
        <div>
          <label class="block text-sm font-medium mb-2">收集类型</label>
          <div class="flex gap-4">
            <div class="flex items-center gap-2">
              <RadioButton v-model="collectionItemType" value="css" inputId="css-type" />
              <label for="css-type">CSS 选择器</label>
            </div>
            <div class="flex items-center gap-2">
              <RadioButton v-model="collectionItemType" value="js" inputId="js-type" />
              <label for="js-type">JavaScript 代码</label>
            </div>
          </div>
        </div>

        <!-- CSS Configuration -->
        <div v-if="collectionItemType === 'css'">
          <label class="block text-sm font-medium mb-2">CSS 选择器 *</label>
          <InputText
            v-model="collectionForm.selector"
            placeholder="例如: .title, #content, h1"
            class="w-full" />

          <label class="block text-sm font-medium mb-2 mt-4">属性 (可选)</label>
          <InputText
            v-model="collectionForm.attribute"
            placeholder="例如: href, src, text (留空获取文本内容)"
            class="w-full" />
          <small class="text-gray-500">留空获取元素的文本内容，指定属性名获取对应属性值</small>
        </div>

        <!-- JavaScript Configuration -->
        <div v-if="collectionItemType === 'js'">
          <label class="block text-sm font-medium mb-2">JavaScript 代码 *</label>
          <Textarea
            v-model="collectionForm.code"
            placeholder="// 返回要收集的数据
return document.title;"
            rows="4"
            class="w-full" />
          <small class="text-gray-500">代码必须使用 return 语句返回数据</small>
        </div>
      </div>

      <template #footer>
        <Button label="取消" @click="showDataCollectionDialog = false" severity="secondary" />
        <Button label="保存" @click="saveCollectionItem" />
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
  import { getRulesService } from '@/entrypoints/background/service/rulesService';
  import { getTaskExecutionService } from '@/entrypoints/background/service/taskExecutionService';
  import { onMounted, reactive, ref, watch } from 'vue';

  const taskExecutionService = getTaskExecutionService();
  const rulesService = getRulesService();

  // Helper functions
  const hasUnreadExecutionsAsync = async (ruleId: string): Promise<boolean> => {
    try {
      const executions = await taskExecutionService.getByRuleId(ruleId, {
        limit: 1, // 只需要检查是否存在未读记录
        isRead: 0, // 直接查询未读记录
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      console.log('[调试] 规则', ruleId, '的未读检查结果:', executions.executions.length > 0);
      // 如果有未读记录，则返回 true
      return executions.executions.length > 0;
    } catch (error) {
      console.error('Failed to check unread executions for rule:', ruleId, error);
      return false;
    }
  };

  import type { Rule } from '@/entrypoints/background/service/rulesService';
  import { format } from 'date-fns';
  import RuleExecutionRecords from './RuleExecutionRecords.vue';

  // PrimeVue components
  import Accordion from 'primevue/accordion';
  import AccordionPanel from 'primevue/accordionpanel';
  import AccordionHeader from 'primevue/accordionheader';
  import AccordionContent from 'primevue/accordioncontent';
  import Button from 'primevue/button';
  import Chip from 'primevue/chip';
  import InputChips from 'primevue/inputchips';
  import Column from 'primevue/column';
  import DataTable from 'primevue/datatable';
  import Dialog from 'primevue/dialog';
  import IconField from 'primevue/iconfield';
  import InputIcon from 'primevue/inputicon';
  import InputNumber from 'primevue/inputnumber';
  import InputText from 'primevue/inputtext';
  import RadioButton from 'primevue/radiobutton';
  import Select from 'primevue/select';
  import Textarea from 'primevue/textarea';
  import { useToast } from 'primevue/usetoast';

  // Toast service
  const toast = useToast();

  // State
  const rules = ref<Rule[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const deleting = ref(false);
  const showCreateDialog = ref(false);
  const showDeleteDialog = ref(false);
  const editingRule = ref<Rule | null>(null);
  const selectedRule = ref<Rule | null>(null);
  const expandedRows = ref<Record<string, boolean>>({});

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
      dataCollection: [] as any[],
    },
    tags: [] as string[],
    priority: 1,
  });

  const taskConfigJson = ref('{}');
  const errors = ref<Record<string, string>>({});

  // Data collection configuration
  const showDataCollectionDialog = ref(false);
  const editingCollectionItem = ref<any>(null);
  const collectionItemType = ref<'css' | 'js'>('css');
  const collectionForm = reactive({
    selector: '',
    attribute: '',
    code: '',
  });

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

  // 处理执行记录读取状态变更
  const handleReadStatusChanged = async (ruleId: string) => {
    // 重新检查该规则的未读状态
    try {
      const hasUnread = await hasUnreadExecutionsAsync(ruleId);
      ruleUnreadStatus.value[ruleId] = hasUnread;
    } catch (error) {
      console.error('Failed to check rule unread status:', error);
    }
  };

  // 处理所有记录标记为已读
  const handleAllMarkedAsRead = async (ruleId: string) => {
    // 更新该规则的未读状态为 false
    ruleUnreadStatus.value[ruleId] = false;
  };

  // 检测规则是否有未读的执行记录
  const ruleUnreadStatus = ref<Record<string, boolean>>({});

  const hasUnreadExecutions = (ruleId: string) => {
    return ruleUnreadStatus.value[ruleId] || false;
  };

  // Methods
  const loadRules = async () => {
    loading.value = true;
    try {
      const result = await rulesService.query({
        page: currentPage.value,
        limit: pageSize.value,
        status: statusFilter.value || undefined,
        search: searchQuery.value || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      rules.value = result.rules;
      totalRecords.value = result.total;

      // 检查每个规则的未读执行记录状态
      await checkRulesUnreadStatus();
    } finally {
      loading.value = false;
    }
  };

  const loadStats = async () => {
    try {
      stats.value = await rulesService.getRuleStats();
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const checkRulesUnreadStatus = async () => {
    try {
      // 重置未读状态
      ruleUnreadStatus.value = {};

      // 并行检查每个规则的未读状态
      const checkPromises = rules.value.map(async (rule: Rule) => {
        const hasUnread = await hasUnreadExecutionsAsync(rule.id);
        return { ruleId: rule.id, hasUnread };
      });

      const results = await Promise.all(checkPromises);
      // 设置未读状态
      for (const result of results) {
        ruleUnreadStatus.value[result.ruleId] = result.hasUnread;
      }
    } catch (error) {
      console.error('Failed to check rules unread status:', error);
    }
  };

  const handlePageChange = (event: any) => {
    currentPage.value = event.page + 1;
    pageSize.value = event.rows;
    loadRules();
  };

  const getRowStyle = (rule: Rule) => {
    const hasUnread = hasUnreadExecutions(rule.id);

    if (hasUnread) {
      return {
        backgroundColor: '#ffffff',
        borderLeft: '3px solid #3b82f6',
        fontWeight: '500',
        cursor: 'pointer',
      };
    } else {
      return {
        backgroundColor: '#f8fafc',
        cursor: 'pointer',
      };
    }
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

  const resetCollectionForm = () => {
    Object.assign(collectionForm, {
      selector: '',
      attribute: '',
      code: '',
    });
    collectionItemType.value = 'css';
    editingCollectionItem.value = null;
  };

  const showAddCollectionDialog = () => {
    resetCollectionForm();
    showDataCollectionDialog.value = true;
  };

  const editCollectionItem = (item: any, index: number) => {
    editingCollectionItem.value = index;
    collectionItemType.value = item.type;

    if (item.type === 'css') {
      collectionForm.selector = item.selector;
      collectionForm.attribute = item.attribute || '';
    } else {
      collectionForm.code = item.code;
    }

    showDataCollectionDialog.value = true;
  };

  const saveCollectionItem = () => {
    // Ensure dataCollection array exists
    if (!ruleForm.taskConfig.dataCollection) {
      ruleForm.taskConfig.dataCollection = [];
    }

    const collectionItem: any = {
      type: collectionItemType.value,
    };

    if (collectionItemType.value === 'css') {
      if (!collectionForm.selector.trim()) {
        toast.add({
          severity: 'error',
          summary: '验证错误',
          detail: 'CSS 选择器不能为空',
          life: 3000,
        });
        return;
      }
      collectionItem.selector = collectionForm.selector.trim();
      if (collectionForm.attribute.trim()) {
        collectionItem.attribute = collectionForm.attribute.trim();
      }
    } else {
      if (!collectionForm.code.trim()) {
        toast.add({
          severity: 'error',
          summary: '验证错误',
          detail: 'JavaScript 代码不能为空',
          life: 3000,
        });
        return;
      }
      collectionItem.code = collectionForm.code.trim();
    }

    if (editingCollectionItem.value !== null) {
      // Edit existing item
      ruleForm.taskConfig.dataCollection[editingCollectionItem.value] = collectionItem;
    } else {
      // Add new item
      ruleForm.taskConfig.dataCollection.push(collectionItem);
    }

    // Update JSON representation
    taskConfigJson.value = JSON.stringify(ruleForm.taskConfig, null, 2);

    showDataCollectionDialog.value = false;
    resetCollectionForm();
  };

  const removeCollectionItem = (index: number) => {
    if (ruleForm.taskConfig.dataCollection) {
      ruleForm.taskConfig.dataCollection.splice(index, 1);
      // Update JSON representation
      taskConfigJson.value = JSON.stringify(ruleForm.taskConfig, null, 2);
    }
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
      const ruleData = { ...ruleForm };

      console.log('[ruleData]', ruleData);
      if (editingRule.value) {
        await rulesService.updateRule(editingRule.value.id, ruleData);
      } else {
        await rulesService.createRule(ruleData);
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
      taskConfig: {
        url: rule.taskConfig.url || '',
        timeout: rule.taskConfig.timeout || 30000,
        dataCollection: rule.taskConfig.dataCollection || [],
      },
      tags: rule.tags || [],
      priority: rule.priority || 1,
    });
    taskConfigJson.value = JSON.stringify(ruleForm.taskConfig, null, 2);
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
      await rulesService.deleteRule(selectedRule.value.id);
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
      await rulesService.activateRule(rule.id);
      loadRules();
      loadStats();
    } catch (error) {
      console.error('Failed to activate rule:', error);
    }
  };

  const pauseRule = async (rule: Rule) => {
    try {
      await rulesService.pauseRule(rule.id);
      loadRules();
      loadStats();
    } catch (error) {
      console.error('Failed to pause rule:', error);
    }
  };

  const executeRuleNow = async (rule: Rule) => {
    try {
      const result = await rulesService.executeRule(rule.id);
      if (result.success) {
        const res = result.result;
        if (res.matched === 1) {
          toast.add({
            severity: 'success',
            summary: '执行成功',
            detail: `规则 "${rule.name}" 执行成功！\nURL: ${res.url}\n标题: ${res.title}`,
            life: 5000,
          });
        } else {
          toast.add({
            severity: 'warn',
            summary: '执行完成',
            detail: `规则 "${rule.name}" 执行完成，但未匹配到内容。\n消息: ${res.message || '无'}`,
            life: 5000,
          });
        }

        // 延迟刷新页面以等待新任务记录创建完成
        setTimeout(() => {
          loadRules();
          loadStats();
        }, 1000);
      } else {
        toast.add({
          severity: 'error',
          summary: '执行失败',
          detail: `规则 "${rule.name}" 执行失败: ${result.message}`,
          life: 5000,
        });
      }
    } catch (error) {
      console.error('Failed to execute rule:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.add({
        severity: 'error',
        summary: '执行失败',
        detail: `规则 "${rule.name}" 执行失败: ${errorMessage}`,
        life: 5000,
      });
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

  // Watch for data collection dialog close
  watch(showDataCollectionDialog, (newValue) => {
    if (!newValue) {
      resetCollectionForm();
    }
  });

  // Expose methods for parent component
  defineExpose({
    loadRules,
    loadStats,
  });
</script>
