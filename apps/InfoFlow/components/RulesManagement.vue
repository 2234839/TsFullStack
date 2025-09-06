<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">网页信息订阅管理</h1>
        <p class="text-gray-600">管理您的自动化信息订阅规则</p>
        <div class="mt-2 flex items-center gap-4">
          <div class="flex items-center gap-2">
            <ToggleSwitch v-model="config.autoMarkAsRead" inputId="auto-read-switch" />
            <label for="auto-read-switch" class="text-sm text-gray-600 cursor-pointer">
              自动已读（结果没有新增条目时自动标记为已读）
            </label>
          </div>
          <div class="flex items-center gap-2">
            <Button
              icon="pi pi-filter"
              @click="showGlobalFilterDialog = true"
              size="small"
              severity="info"
              variant="outlined"
              label="全局过滤配置" />
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <Button
          icon="pi pi-refresh"
          @click="rules.execute()"
          :loading="rules.isLoading.value"
          severity="secondary"
          size="small" />
        <Button
          icon="pi pi-download"
          @click="showExportDialog = true"
          label="导出"
          severity="info"
          size="small" />
        <Button
          icon="pi pi-upload"
          @click="showImportDialog = true"
          label="导入"
          severity="success"
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
          :value="rules.state.value.rules"
          :loading="userActionLoading"
          :paginator="true"
          :rows="config.rulesPageSize"
          :totalRecords="rules.state.value.total"
          :rowsPerPageOptions="[10, 20, 50]"
          :lazy="true"
          @page="handlePageChange"
          @row-click="handleRowClick"
          responsiveLayout="scroll"
          v-model:expandedRows="expandedRows"
          dataKey="id"
          :rowStyle="getRowStyle">
          <Column :expander="true" headerStyle="width: 3rem" />
          <Column field="name" header="规则名称" class="min-w-[150px] whitespace-nowrap">
            <template #body="{data}:{data:RulesTable}">
              <div class="flex items-center gap-2">
                <div
                  v-if="hasUnreadExecutions(data.id)"
                  class="w-2 h-2 rounded-full bg-blue-500"
                  title="有未读的执行记录"></div>
                <div>
                  <a
                    :href="data.taskConfig.url"
                    target="_blank"
                    class="font-medium text-blue-600 hover:text-blue-800 hover:underline">
                    {{ data.name }}
                  </a>
                  <div class="text-sm text-gray-600">{{ data.description }}</div>
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

          <Column field="executionCount" header="执行次数" class="w-[80px] whitespace-nowrap">
            <template #body="slotProps">
              <div class="text-center">
                <div v-if="slotProps.data.lastExecutedAt" class="text-xs text-gray-500">
                  上次：{{ formatDate(slotProps.data.lastExecutedAt) }}
                </div>
                <span>
                  共 <span class="font-medium">{{ slotProps.data.executionCount }}</span> 次
                </span>
              </div>
            </template>
          </Column>

          <Column field="cron" header="执行计划" class="w-[180px] whitespace-nowrap">
            <template #body="slotProps">
              <div class="text-sm" :title="slotProps.data.cron">
                <div
                  v-if="slotProps.data.status === 'paused'"
                  class="text-xs text-orange-600 font-medium">
                  已暂停
                </div>
                <div v-else-if="slotProps.data.nextExecutionAt">
                  <div class="text-xs text-gray-500 mb-1">
                    下次: {{ formatDate(slotProps.data.nextExecutionAt) }}
                  </div>
                  <div class="w-full">
                    <CustomProgressBar
                      :value="
                        getExecutionProgress(slotProps.data.nextExecutionAt, slotProps.data.cron)
                      "
                      :text="getCountdownTime(slotProps.data.nextExecutionAt)"
                      class="h-2 w-full" />
                  </div>
                </div>
                <div v-else class="text-xs text-gray-400">未调度</div>
              </div>
            </template>
          </Column>
          <Column field="actions" header="操作" class="w-[280px] whitespace-nowrap">
            <template #body="{ data }: { data: Rule }">
              <div class="flex gap-1">
                <Button
                  v-if="data.status === 'paused'"
                  icon="pi pi-play"
                  @click="activateRule(data)"
                  size="small"
                  severity="success"
                  v-tooltip="'激活'" />
                <Button
                  v-if="data.status === 'active'"
                  icon="pi pi-pause"
                  @click="pauseRule(data)"
                  size="small"
                  severity="warning"
                  v-tooltip="'暂停'" />
                <Button
                  icon="pi pi-play-circle"
                  @click="executeRuleNow(data)"
                  size="small"
                  severity="primary"
                  v-tooltip="'立即执行'" />
                <Button
                  icon="pi pi-file-edit"
                  @click="editRule(data)"
                  size="small"
                  severity="secondary"
                  v-tooltip="'编辑'" />
                <Button
                  icon="pi pi-trash"
                  @click="confirmDelete(data)"
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
      class="max-w-[70vw] w-[800px]">
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
          <label class="block text-sm font-medium mb-2">规则描述</label>
          <Textarea
            v-model="ruleForm.description"
            placeholder="输入规则描述"
            rows="2"
            class="w-full" />
        </div>

        <div>
          <CronSelector v-model="ruleForm.cron" :error="errors.cron" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">状态</label>
          <Select
            v-model="ruleForm.status"
            :options="statusOptions"
            optionLabel="label"
            optionValue="value" />
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

        <!-- 过滤配置策略选择 -->
        <div class="col-span-2">
          <label class="block text-sm font-medium mb-2">信息过滤配置</label>

          <!-- 过滤策略选择 -->
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2">过滤策略</label>
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <RadioButton
                  v-model="filterStrategy"
                  value="inherit"
                  inputId="inherit-strategy" />
                <label for="inherit-strategy" class="text-sm">继承全局过滤配置</label>
              </div>
              <div class="flex items-center gap-2">
                <RadioButton
                  v-model="filterStrategy"
                  value="custom"
                  inputId="custom-strategy" />
                <label for="custom-strategy" class="text-sm">自定义过滤配置</label>
              </div>
              <div class="flex items-center gap-2">
                <RadioButton
                  v-model="filterStrategy"
                  value="disable"
                  inputId="disable-strategy" />
                <label for="disable-strategy" class="text-sm">禁用过滤</label>
              </div>
            </div>
          </div>

          <!-- 显示全局配置信息 -->
          <div v-if="filterStrategy === 'inherit' && config.globalFilterConfig" class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div class="flex items-center gap-2 mb-2">
              <i class="pi pi-info-circle text-blue-600"></i>
              <span class="text-sm font-medium text-blue-800">使用全局过滤配置</span>
            </div>
            <div class="text-xs text-blue-700">
              <div v-if="config.globalFilterConfig.enable">
                全局过滤已启用：{{ config.globalFilterConfig.filterType === 'js' ? 'JavaScript 过滤' : 'AI 过滤' }}
              </div>
              <div v-else>
                全局过滤已禁用
              </div>
            </div>
          </div>

          <!-- 自定义过滤配置 -->
          <div v-if="filterStrategy === 'custom'" class="border rounded-lg p-4 bg-gray-50">
            <FilterConfig
              :modelValue="ruleForm.taskConfig.ruleFilterConfig?.filterConfig"
              @update:modelValue="handleFilterConfigChange" />
          </div>

          <!-- 禁用状态提示 -->
          <div v-if="filterStrategy === 'disable'" class="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div class="flex items-center gap-2">
              <i class="pi pi-ban text-gray-600"></i>
              <span class="text-sm text-gray-600">过滤功能已禁用</span>
            </div>
          </div>
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

    <!-- Export Rules Selection Dialog -->
    <RuleSelectionDialog
      v-model:visible="showExportDialog"
      :rules="allRules"
      title="选择要导出的规则"
      confirm-label="导出选中规则"
      confirm-severity="info"
      :show-bulk-actions="true"
      @confirm="handleExportConfirm"
      @cancel="showExportDialog = false" />

    <!-- Import Rules Dialog -->
    <Dialog v-model:visible="showImportDialog" header="导入规则" modal class="max-w-[600px]">
      <div class="flex flex-col gap-4">
        <div>
          <label class="block text-sm font-medium mb-2">选择 JSON 文件</label>
          <input
            type="file"
            accept=".json"
            @change="handleFileSelect"
            class="w-full p-2 border rounded-md"
            ref="fileInput" />
        </div>
        <div v-if="importPreview">
          <label class="block text-sm font-medium mb-2">预览导入内容</label>
          <div class="bg-gray-50 p-4 rounded-md max-h-64 overflow-y-auto">
            <pre class="text-sm">{{ JSON.stringify(importPreview, null, 2) }}</pre>
          </div>
          <p class="text-sm text-gray-600 mt-2">将导入 {{ importPreview.length }} 条规则</p>
        </div>
      </div>

      <template #footer>
        <Button label="取消" @click="cancelImport" severity="secondary" />
        <Button
          label="选择导入"
          @click="showImportSelectionDialog = true"
          :disabled="!importPreview.length"
          severity="success" />
      </template>
    </Dialog>

    <!-- Import Rules Selection Dialog -->
    <RuleSelectionDialog
      v-model:visible="showImportSelectionDialog"
      :rules="importPreview"
      title="选择要导入的规则"
      confirm-label="导入选中规则"
      confirm-severity="success"
      :show-bulk-actions="true"
      @confirm="handleImportConfirm"
      @cancel="showImportSelectionDialog = false" />

    <!-- Global Filter Configuration Dialog -->
    <Dialog
      v-model:visible="showGlobalFilterDialog"
      header="全局过滤配置"
      modal
      class="max-w-[600px]">
      <div class="space-y-4">
        <p class="text-sm text-gray-600">
          配置全局过滤规则，这些规则将应用于所有选择"继承全局过滤配置"的订阅规则。
        </p>

        <FilterConfig
          :modelValue="config.globalFilterConfig || {
            enable: false,
            filterType: 'js',
            jsFilter: { code: '' },
            aiFilter: { model: '', prompt: '', ollamaUrl: 'http://localhost:11434' },
          }"
          @update:modelValue="handleGlobalFilterConfigChange" />
      </div>

      <template #footer>
        <Button label="取消" @click="showGlobalFilterDialog = false" severity="secondary" />
        <Button label="保存" @click="saveGlobalFilterConfig" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { getRulesService } from '@/entrypoints/background/service/rulesService';
  import { getDbService, RulesTable } from '@/entrypoints/background/service/dbService';
  import { getTaskExecutionService } from '@/entrypoints/background/service/taskExecutionService';
  import { useNow } from '@vueuse/core';
  import { computed, onMounted, reactive, ref, watch } from 'vue';
  import { getCronInterval, formatCountdown } from '@/utils/cronUtils';
  import { browser } from '#imports';
  import { EVENT_TYPES } from '@/constants/events';
  import { useInfoFlowConfig } from '@/storage/config';
  import RuleSelectionDialog from './RuleSelectionDialog.vue';
  import FilterConfig from "./FilterConfig.vue"
  const taskExecutionService = getTaskExecutionService();
  const rulesService = getRulesService();
  const now = useNow();
  const config = useInfoFlowConfig();

  // Helper functions
  const hasUnreadExecutionsAsync = async (ruleId: string): Promise<boolean> => {
    try {
      const hasUnread = await taskExecutionService.hasUnreadExecutions(ruleId);
      return hasUnread;
    } catch (error) {
      console.error('Failed to check unread executions for rule:', ruleId, error);
      return false;
    }
  };

  // 计算执行进度（基于cron表达式的实际间隔）
  const getExecutionProgress = (nextExecutionAt: string, cronExpression?: string): number => {
    try {
      const nextTime = new Date(nextExecutionAt);
      const currentTime = now.value;

      // 如果下次执行时间已经过去，返回100
      if (nextTime <= currentTime) {
        return 100;
      }

      // 如果没有提供cron表达式，使用默认的1天间隔
      const interval = cronExpression ? getCronInterval(cronExpression) : 24 * 60 * 60 * 1000;

      // 计算本次周期的开始时间
      const cycleStartTime = new Date(nextTime.getTime() - interval);

      // 如果当前时间在周期开始时间之前，说明计算有误
      if (currentTime < cycleStartTime) {
        return 0;
      }

      // 计算进度
      const elapsed = currentTime.getTime() - cycleStartTime.getTime();
      const progress = (elapsed / interval) * 100;

      const finalProgress = Math.round(Math.min(100, Math.max(0, progress)));
      return finalProgress;
    } catch (error) {
      console.error('Error calculating execution progress:', error);
      return 0;
    }
  };

  // 计算倒计时时间
  const getCountdownTime = (nextExecutionAt: string): string => {
    try {
      const nextTime = new Date(nextExecutionAt);
      const currentTime = now.value;

      // 如果下次执行时间已经过去，返回"立即执行"
      if (nextTime <= currentTime) {
        return '立即执行';
      }

      const timeUntilExecution = nextTime.getTime() - currentTime.getTime();
      return formatCountdown(timeUntilExecution);
    } catch (error) {
      console.error('Error calculating countdown time:', error);
      return '计算错误';
    }
  };

  import type { Rule } from '@/entrypoints/background/service/rulesService';
  import { format } from 'date-fns';
  import RuleExecutionRecords from './RuleExecutionRecords.vue';
  import CronSelector from './CronSelector.vue';

  // PrimeVue components
  import Accordion from 'primevue/accordion';
  import AccordionPanel from 'primevue/accordionpanel';
  import AccordionHeader from 'primevue/accordionheader';
  import AccordionContent from 'primevue/accordioncontent';
  import CustomProgressBar from './CustomProgressBar.vue';
  import Button from 'primevue/button';
  import Column from 'primevue/column';
  import DataTable from 'primevue/datatable';
  import Dialog from 'primevue/dialog';
  import IconField from 'primevue/iconfield';
  import InputIcon from 'primevue/inputicon';
  import InputNumber from 'primevue/inputnumber';
  import InputText from 'primevue/inputtext';
  import ToggleSwitch from 'primevue/toggleswitch';
  import RadioButton from 'primevue/radiobutton';
  import Select from 'primevue/select';
  import Textarea from 'primevue/textarea';
  import { useToast } from 'primevue/usetoast';
  import { useAsyncState } from '@vueuse/core';

  // Toast service
  const toast = useToast();

  const saving = ref(false);
  const deleting = ref(false);
  const showCreateDialog = ref(false);
  const showDeleteDialog = ref(false);
  const showExportDialog = ref(false);
  const showImportDialog = ref(false);
  const showImportSelectionDialog = ref(false);
  const showGlobalFilterDialog = ref(false);
  const importing = ref(false);
  const editingRule = ref<Rule | null>(null);
  const selectedRule = ref<Rule | null>(null);
  const expandedRows = ref<Record<string, boolean>>({});
  const fileInput = ref<HTMLInputElement | null>(null);
  const importPreview = ref<any[]>([]);
  const importFile = ref<File | null>(null);
  const allRules = ref<Rule[]>([]);

  // Pagination
  const currentPage = ref(1);

  // Search and filters
  const searchQuery = ref('');
  const statusFilter = ref<'active' | 'inactive' | 'paused' | ''>('');

  // 用户主动操作的loading状态
  const userActionLoading = ref(false);

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
      ruleFilterConfig: {
        useGlobalFilter: true,
        disableGlobalFilter: false,
        filterConfig: {
          enable: false,
          filterType: 'js' as 'js' | 'ai',
          jsFilter: {
            code: '',
          },
          aiFilter: {
            model: '',
            prompt: '',
            ollamaUrl: '',
          },
        },
      },
    },
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


  // 处理过滤配置变化
  const handleFilterConfigChange = (filterConfig: any) => {
    // 确保 filterConfig 有正确的类型
    const typedFilterConfig = {
      enable: filterConfig.enable || false,
      filterType: (filterConfig.filterType || 'js') as 'js' | 'ai',
      jsFilter: filterConfig.jsFilter || { code: '' },
      aiFilter: filterConfig.aiFilter || { model: '', prompt: '', ollamaUrl: '' },
    };

    // 确保 ruleFilterConfig 对象存在
    if (!ruleForm.taskConfig.ruleFilterConfig) {
      ruleForm.taskConfig.ruleFilterConfig = {
        useGlobalFilter: false,
        disableGlobalFilter: false,
        filterConfig: typedFilterConfig,
      };
    } else {
      ruleForm.taskConfig.ruleFilterConfig.useGlobalFilter = false;
      ruleForm.taskConfig.ruleFilterConfig.disableGlobalFilter = false;
      ruleForm.taskConfig.ruleFilterConfig.filterConfig = typedFilterConfig;
    }
  };

  // 处理全局过滤配置变化
  const handleGlobalFilterConfigChange = (filterConfig: any) => {
    // 直接更新配置
    config.value.globalFilterConfig = filterConfig;
  };

  // 保存全局过滤配置
  const saveGlobalFilterConfig = () => {
    // 配置已经通过 v-model 自动更新到 config.globalFilterConfig
    // 这里只需要关闭对话框
    showGlobalFilterDialog.value = false;

    toast.add({
      severity: 'success',
      summary: '保存成功',
      detail: '全局过滤配置已保存',
      life: 3000,
    });
  };

  // 计算过滤策略
  const filterStrategy = computed<'inherit' | 'custom' | 'disable'>(() => {
    if (!ruleForm.taskConfig.ruleFilterConfig) {
      return 'inherit'; // 默认继承全局配置
    }

    if (ruleForm.taskConfig.ruleFilterConfig.disableGlobalFilter) {
      return 'disable';
    }

    if (ruleForm.taskConfig.ruleFilterConfig.useGlobalFilter) {
      return 'inherit';
    }

    return 'custom';
  });

  // 检测规则是否有未读的执行记录
  const ruleUnreadStatus = ref<Record<string, boolean>>({});

  const hasUnreadExecutions = (ruleId: string) => {
    return ruleUnreadStatus.value[ruleId] || false;
  };
  /** 等待 config 加载 */
  const awaitConfig = new Promise((r) => setTimeout(r, 100));
  const rules = useAsyncState(
    async () => {
      await awaitConfig;
      const result = await rulesService.query({
        page: currentPage.value,
        limit: config.value.rulesPageSize,
        status: statusFilter.value || undefined,
        search: searchQuery.value || undefined,
        sortBy: 'unreadFirst', // 使用特殊的排序方式，将未读的排在前面
        sortOrder: 'desc',
      });

      // 检查每个规则的未读执行记录状态
      await checkRulesUnreadStatus();

      return {
        rules: result.rules,
        total: result.total,
      };
    },
    {
      rules: [],
      total: 0,
    },
    {
      resetOnExecute: false,
    },
  );

  const loadStats = async () => {
    try {
      stats.value = await rulesService.getRuleStats();
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadAllRules = async () => {
    try {
      allRules.value = await rulesService.getAll();
    } catch (error) {
      console.error('Failed to load all rules:', error);
    }
  };

  const checkRulesUnreadStatus = async () => {
    try {
      // 重置未读状态
      ruleUnreadStatus.value = {};

      // 并行检查每个规则的未读状态
      const checkPromises = rules.state.value.rules.map(async (rule: Rule) => {
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
    config.value.rulesPageSize = event.rows;
    userActionLoading.value = true;
    rules.execute().finally(() => {
      userActionLoading.value = false;
    });
  };

  const handleRowClick = (event: any) => {
    const rule = event.data;
    const ruleId = rule.id;

    // 切换展开状态
    if (expandedRows.value[ruleId]) {
      // 如果已展开，则收缩
      const newExpandedRows = { ...expandedRows.value };
      delete newExpandedRows[ruleId];
      expandedRows.value = newExpandedRows;
    } else {
      // 如果已收缩，则展开
      expandedRows.value = {
        ...expandedRows.value,
        [ruleId]: true
      };
    }
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
    userActionLoading.value = true;
    rules.execute().finally(() => {
      userActionLoading.value = false;
    });
  };

  const handleFilterChange = () => {
    currentPage.value = 1;
    userActionLoading.value = true;
    rules.execute().finally(() => {
      userActionLoading.value = false;
    });
  };

  const clearFilters = () => {
    searchQuery.value = '';
    statusFilter.value = '';
    currentPage.value = 1;
    userActionLoading.value = true;
    rules.execute().finally(() => {
      userActionLoading.value = false;
    });
  };

  // 静默更新规则数据，不显示loading，保持用户操作状态
  const silentUpdateRules = async () => {
    try {
      // 保存当前的展开状态
      const currentExpandedRows = { ...expandedRows.value };

      // 获取最新的数据
      const result = await rulesService.query({
        page: currentPage.value,
        limit: config.value.rulesPageSize,
        status: statusFilter.value || undefined,
        search: searchQuery.value || undefined,
        sortBy: 'unreadFirst',
        sortOrder: 'desc',
      });

      // 检查每个规则的未读执行记录状态
      await checkRulesUnreadStatus();

      // 直接更新rules数据，不触发loading状态
      rules.state.value = {
        rules: result.rules,
        total: result.total,
      };

      // 恢复展开状态
      expandedRows.value = currentExpandedRows;

      console.log('[RulesManagement] 静默更新完成');
    } catch (error) {
      console.error('[RulesManagement] 静默更新失败:', error);
    }
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
        ruleFilterConfig: {
          useGlobalFilter: true,
          disableGlobalFilter: false,
          filterConfig: {
            enable: false,
            filterType: 'js' as 'js' | 'ai',
            jsFilter: {
              code: '',
            },
            aiFilter: {
              model: '',
              prompt: '',
              ollamaUrl: '',
            },
          },
        },
      },
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
      rules.execute();
      loadStats();
      loadAllRules();
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
        ruleFilterConfig: rule.taskConfig.ruleFilterConfig || {
          useGlobalFilter: true,
          disableGlobalFilter: false,
          filterConfig: {
            enable: false,
            filterType: 'js' as 'js' | 'ai',
            jsFilter: {
              code: '',
            },
            aiFilter: {
              model: '',
              prompt: '',
              ollamaUrl: '',
            },
          },
        },
      },
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
      rules.execute();
      loadStats();
      loadAllRules();
    } finally {
      deleting.value = false;
    }
  };

  const activateRule = async (rule: Rule) => {
    try {
      await rulesService.activateRule(rule.id);
      rules.execute();
      loadStats();
      loadAllRules();
    } catch (error) {
      console.error('Failed to activate rule:', error);
    }
  };

  const pauseRule = async (rule: Rule) => {
    try {
      await rulesService.pauseRule(rule.id);
      rules.execute();
      loadStats();
      loadAllRules();
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
        rules.execute();
        loadStats();
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
    rules.execute();
    loadStats();
    loadAllRules();

    // 监听规则执行完成事件
    if (browser.runtime) {
      browser.runtime.onMessage.addListener((message: any) => {
        if (message.type === EVENT_TYPES.RULE_EXECUTION_COMPLETED) {
          console.log('[RulesManagement] 收到规则执行完成事件:', message.payload);
          // 静默更新数据，不显示loading，保持用户操作状态
          silentUpdateRules();
          loadStats();
          loadAllRules();
        }
      });
    }
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

  // Handle export confirmation
  const handleExportConfirm = async (selectedRuleIds: string[]) => {
    try {
      const selectedRulesData = allRules.value.filter((rule) => selectedRuleIds.includes(rule.id));

      if (selectedRulesData.length === 0) {
        toast.add({
          severity: 'warn',
          summary: '没有选择规则',
          detail: '请至少选择一条规则进行导出',
          life: 3000,
        });
        return;
      }

      const exportData = {
        exportTime: new Date().toISOString(),
        version: '1.0',
        rules: selectedRulesData,
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `rules-export-${selectedRulesData.length}-rules-${
        new Date().toISOString().split('T')[0]
      }.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showExportDialog.value = false;

      toast.add({
        severity: 'success',
        summary: '导出成功',
        detail: `已导出 ${selectedRulesData.length} 条规则`,
        life: 3000,
      });
    } catch (error) {
      console.error('Failed to export rules:', error);
      toast.add({
        severity: 'error',
        summary: '导出失败',
        detail: '导出规则时发生错误',
        life: 3000,
      });
    }
  };

  // Handle file selection for import
  const handleFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) {
      importPreview.value = [];
      importFile.value = null;
      return;
    }

    if (!file.name.endsWith('.json')) {
      toast.add({
        severity: 'error',
        summary: '文件格式错误',
        detail: '请选择 JSON 文件',
        life: 3000,
      });
      return;
    }

    importFile.value = file;

    // Read and preview the file
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (!data.rules || !Array.isArray(data.rules)) {
          throw new Error('无效的规则文件格式');
        }

        // Preserve original IDs for selection purposes
        importPreview.value = data.rules.map((rule: any, index: number) => ({
          ...rule,
          // Ensure every rule has an ID for selection
          id: rule.id,
          // Store original index for fallback matching
          originalIndex: index,
        }));
      } catch (error) {
        console.error('Failed to parse JSON file:', error);
        toast.add({
          severity: 'error',
          summary: '文件解析失败',
          detail: '无法解析 JSON 文件',
          life: 3000,
        });
        importPreview.value = [];
        importFile.value = null;
      }
    };
    reader.readAsText(file);
  };

  // Cancel import
  const cancelImport = () => {
    showImportDialog.value = false;
    importPreview.value = [];
    importFile.value = null;
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  };

  // Handle import confirmation
  const handleImportConfirm = async (selectedRuleIds: string[]) => {
    if (!importFile.value || importPreview.value.length === 0) {
      return;
    }

    importing.value = true;
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);

          if (!data.rules || !Array.isArray(data.rules)) {
            throw new Error('无效的规则文件格式');
          }

          console.log('[Import] 导入的规则数据:', data.rules.map((r: any) => ({ id: r.id, name: r.name })));

          // 获取当前数据库中的所有规则用于调试
          const currentRules = await rulesService.getAll();
          console.log('[Import] 当前数据库中的规则:', currentRules.map((r: any) => ({ id: r.id, name: r.name })));

          let successCount = 0;
          let skipCount = 0;

          // Only import selected rules
          const selectedRules = data.rules.filter((rule: any) => {
            // 检查是否通过原始ID选中
            return selectedRuleIds.includes(rule.id);
          });

          for (const rule of selectedRules) {
            try {
              // Clean up the rule data for import
              const cleanRule = {
                id: rule.id, // 保留原始ID用于覆盖检查
                name: rule.name,
                description: rule.description || '',
                cron: rule.cron,
                status: rule.status || 'active',
                taskConfig: rule.taskConfig || {
                  url: '',
                  timeout: 30000,
                  dataCollection: [],
                },
                priority: rule.priority || 1,
              };

              // Validate required fields
              if (!cleanRule.name || !cleanRule.cron || !cleanRule.taskConfig.url) {
                skipCount++;
                continue;
              }

              // 检查是否已存在相同ID的规则
              const existingRule = await rulesService.getById(rule.id);
              console.log(`[Import] 检查规则 ${rule.name} (${rule.id}):`, existingRule ? '找到现有规则' : '未找到现有规则');

              if (existingRule) {
                // 如果存在相同ID的规则，则更新它
                const { id, ...ruleData } = cleanRule; // 移除id字段，避免冲突
                await rulesService.updateRule(rule.id, ruleData);
                console.log(`[Import] 覆盖现有规则: ${rule.name} (${rule.id})`);
              } else {
                // 如果不存在，则创建新规则，但保持原有ID
                // 直接使用数据库服务创建，避免服务层自动生成ID
                const dbService = getDbService();
                const newRule: any = {
                  ...cleanRule,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  executionCount: 0,
                };
                await dbService.rules.createWithId(newRule);
                console.log(`[Import] 创建新规则并保持ID: ${rule.name} (${rule.id})`);
              }

              successCount++;
            } catch (error) {
              console.error('Failed to import rule:', rule.name, error);
              skipCount++;
            }
          }

          showImportSelectionDialog.value = false;
          showImportDialog.value = false;
          cancelImport();
          rules.execute();
          loadStats();

          toast.add({
            severity: 'success',
            summary: '导入完成',
            detail: `成功处理 ${successCount} 条规则（覆盖已有规则，跳过 ${skipCount} 条规则）`,
            life: 5000,
          });
        } catch (error) {
          console.error('Failed to import rules:', error);
          toast.add({
            severity: 'error',
            summary: '导入失败',
            detail: '导入规则时发生错误',
            life: 3000,
          });
        } finally {
          importing.value = false;
        }
      };
      reader.readAsText(importFile.value);
    } catch (error) {
      console.error('Failed to read file:', error);
      toast.add({
        severity: 'error',
        summary: '导入失败',
        detail: '读取文件时发生错误',
        life: 3000,
      });
      importing.value = false;
    }
  };

  // Expose methods for parent component
  defineExpose({
    loadRules: () => rules.execute(),
    loadStats,
  });
</script>
