<template>
  <Dialog v-model:visible="visible" :header="title" modal class="max-w-[800px] max-h-[80vh]">
    <div class="flex flex-col gap-4">
      <!-- Search and Filter -->
      <div class="flex gap-2 items-center">
        <IconField class="flex-1">
          <InputIcon class="pi pi-search" />
          <InputText
            v-model="searchQuery"
            placeholder="搜索规则名称或描述..."
            @input="handleSearch" />
        </IconField>
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
          label="清除" />
      </div>

      <!-- Selection Controls -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <Checkbox
            v-model="selectAll"
            :binary="true"
            @change="handleSelectAll" />
          <label class="text-sm cursor-pointer">全选所有</label>
          <span class="text-sm text-gray-600">
            已选择 {{ selectedRules.length }} / {{ props.rules.length }} 条规则
          </span>
          <span v-if="searchQuery || statusFilter" class="text-sm text-blue-600">
            (当前筛选: {{ filteredRules.length }} 条)
          </span>
        </div>
        <div class="flex gap-1">
          <Button
            v-if="showBulkActions && (searchQuery || statusFilter)"
            icon="pi pi-check-double"
            label="全选当前"
            size="small"
            severity="info"
            @click="selectAllFiltered" />
          <Button
            v-if="showBulkActions"
            icon="pi pi-check"
            label="选择激活的"
            size="small"
            severity="success"
            @click="selectByStatus('active')" />
          <Button
            v-if="showBulkActions"
            icon="pi pi-pause"
            label="选择暂停的"
            size="small"
            severity="warning"
            @click="selectByStatus('paused')" />
          <Button
            v-if="showBulkActions"
            icon="pi pi-times"
            label="选择未激活的"
            size="small"
            severity="secondary"
            @click="selectByStatus('inactive')" />
        </div>
      </div>

      <!-- Rules List -->
      <div class="border rounded-lg max-h-[400px] overflow-y-auto">
        <div
          v-for="rule in filteredRules"
          :key="rule.id"
          class="p-3 border-b hover:bg-gray-50 flex items-start gap-3">
          <Checkbox
            v-model="selectedRules"
            :value="rule.id"
            :binary="false"
            class="mt-1" />
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-medium">{{ rule.name }}</span>
              <span
                :class="[
                  'text-xs px-2 py-1 rounded-md',
                  rule.status === 'active'
                    ? 'bg-green-500 text-white'
                    : rule.status === 'inactive'
                    ? 'bg-gray-500 text-white'
                    : 'bg-yellow-500 text-white',
                ]">
                {{ getStatusText(rule.status) }}
              </span>
              <span class="text-xs text-gray-500">
                执行次数: {{ rule.executionCount }}
              </span>
            </div>
            <div class="text-sm text-gray-600 mb-1">{{ rule.description }}</div>
            <div class="text-xs text-gray-500">
              URL: {{ rule.taskConfig.url }}
            </div>
            <div class="text-xs text-gray-500">
              Cron: {{ rule.cron }}
            </div>
          </div>
        </div>
        <div v-if="filteredRules.length === 0" class="p-8 text-center text-gray-500">
          {{ searchQuery || statusFilter ? '没有找到匹配的规则' : '暂无规则' }}
        </div>
      </div>

      <!-- Summary -->
      <div class="bg-gray-50 p-3 rounded-lg">
        <div class="text-sm text-gray-700">
          <strong>选择摘要:</strong>
        </div>
        <div class="text-xs text-gray-600 mt-1">
          <div>总规则数: {{ rules.length }}</div>
          <div>已选择: {{ selectedRules.length }} 条</div>
          <div v-if="selectedRules.length > 0">
            其中: 
            激活 {{ selectedRules.filter(id => rules.find(r => r.id === id)?.status === 'active').length }} 条,
            暂停 {{ selectedRules.filter(id => rules.find(r => r.id === id)?.status === 'paused').length }} 条,
            未激活 {{ selectedRules.filter(id => rules.find(r => r.id === id)?.status === 'inactive').length }} 条
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <Button label="取消" @click="cancel" severity="secondary" />
      <Button 
        :label="confirmLabel" 
        @click="confirm" 
        :disabled="selectedRules.length === 0"
        :severity="confirmSeverity" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Rule } from '@/entrypoints/background/service/rulesService';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Dialog from 'primevue/dialog';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';

interface Props {
  visible: boolean;
  rules: Rule[];
  title: string;
  confirmLabel: string;
  confirmSeverity?: 'success' | 'info' | 'warning' | 'danger';
  showBulkActions?: boolean;
  initialSelected?: string[];
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm', selectedRuleIds: string[]): void;
  (e: 'cancel'): void;
}

const props = withDefaults(defineProps<Props>(), {
  confirmSeverity: 'info',
  showBulkActions: true,
  initialSelected: () => [],
});

const emit = defineEmits<Emits>();

// Search and filter state
const searchQuery = ref('');
const statusFilter = ref<'active' | 'inactive' | 'paused' | ''>('');

// Selection state
const selectedRules = ref<string[]>([]);
const selectAll = ref(false);

// Options
const statusOptions = [
  { label: '激活', value: 'active' },
  { label: '未激活', value: 'inactive' },
  { label: '暂停', value: 'paused' },
];

// Computed
const filteredRules = computed(() => {
  return props.rules.filter((rule) => {
    const matchesSearch = !searchQuery.value || 
      rule.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      rule.description.toLowerCase().includes(searchQuery.value.toLowerCase());
    
    const matchesStatus = !statusFilter.value || rule.status === statusFilter.value;
    
    return matchesSearch && matchesStatus;
  });
});

const visible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

// Methods
const getStatusText = (status: string) => {
  const option = statusOptions.find((opt) => opt.value === status);
  return option?.label || status;
};

const handleSearch = () => {
  // Search is handled by computed property
};

const handleFilterChange = () => {
  // Filter is handled by computed property
};

const clearFilters = () => {
  searchQuery.value = '';
  statusFilter.value = '';
};

const handleSelectAll = () => {
  if (selectAll.value) {
    selectedRules.value = props.rules.map(rule => rule.id);
  } else {
    selectedRules.value = [];
  }
};

const selectAllFiltered = () => {
  const filteredIds = filteredRules.value.map(rule => rule.id);
  selectedRules.value = [...new Set([...selectedRules.value, ...filteredIds])];
};

const selectByStatus = (status: 'active' | 'inactive' | 'paused') => {
  const rulesToAdd = filteredRules.value
    .filter(rule => rule.status === status)
    .map(rule => rule.id);
  
  selectedRules.value = [...new Set([...selectedRules.value, ...rulesToAdd])];
};

const confirm = () => {
  emit('confirm', selectedRules.value);
};

const cancel = () => {
  emit('cancel');
  visible.value = false;
};

// Watchers
watch(() => props.visible, (newValue) => {
  if (newValue) {
    // Reset state when dialog opens
    selectedRules.value = [...props.initialSelected];
    searchQuery.value = '';
    statusFilter.value = '';
    selectAll.value = false;
  }
});

watch([props.rules, selectedRules], () => {
  // Update select all checkbox state based on all rules
  if (props.rules.length === 0) {
    selectAll.value = false;
  } else {
    selectAll.value = selectedRules.value.length === props.rules.length;
  }
}, { deep: true });
</script>