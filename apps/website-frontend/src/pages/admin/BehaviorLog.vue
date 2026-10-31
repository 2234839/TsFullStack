<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- 页面标题 -->
    <PageHeader icon="pi pi-history text-primary-theme">
      {{ t('行为记录') }}
    </PageHeader>

    <!-- 筛选栏 -->
    <Card class="p-4 mb-4">
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-2">
          <label class="text-sm text-primary-theme whitespace-nowrap">{{ t('时间范围') }}:</label>
          <Select v-model="daysFilterStr" :options="daysOptions" class="w-32" />
        </div>
        <!-- 用户多选：空 = 全部用户（默认） -->
        <div class="flex items-center gap-2">
          <label class="text-sm text-primary-theme whitespace-nowrap">{{ t('用户') }}:</label>
          <MultiSelect
            v-model="selectedUserIds"
            :options="userOptions"
            :placeholder="t('全部用户')"
            class="w-64"
            @update:model-value="reload"
          />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm text-primary-theme whitespace-nowrap">{{ t('仅看错误') }}</label>
          <input v-model="errorOnly" type="checkbox" class="accent-[var(--color-primary-500)]" @change="reload" />
        </div>
        <Button :label="t('刷新')" icon="pi pi-refresh" variant="text-button" size="small" @click="reload" />
      </div>
    </Card>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>

    <!-- 行为时间线：按日期分组，垂直时间轴 -->
    <Card v-else-if="rows.length > 0" class="p-0">
      <div v-for="group in groupedRows" :key="group.date" class="relative">
        <!-- 日期分组头 -->
        <div
          class="sticky top-0 z-10 bg-primary-50/90 dark:bg-primary-950/90 backdrop-blur px-4 py-1.5 text-xs font-medium text-primary-theme border-b border-primary-100 dark:border-primary-900"
        >
          {{ group.label }}（{{ group.items.length }}）
        </div>
        <!-- 时间轴主体 -->
        <div class="relative pl-6">
          <!-- 纵向轴线 -->
          <div class="absolute left-[11px] top-0 bottom-0 w-px bg-primary-200 dark:bg-primary-800"></div>
          <div
            v-for="row in group.items"
            :key="row.id"
            class="relative py-2.5 pr-4 cursor-pointer rounded-r-md hover:bg-primary-100/60 dark:hover:bg-primary-900/60 transition-colors"
            @click="openDetail(row)"
          >
            <!-- 状态节点 -->
            <span
              class="absolute -left-6 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-primary-950"
              :class="row.error ? 'bg-danger-500' : 'bg-success-500'"
            ></span>
            <div class="flex items-center gap-3 flex-wrap text-sm">
              <span class="text-xs text-primary-theme/70 font-mono w-16 shrink-0">{{
                formatTime(new Date(row.created))
              }}</span>
              <span class="font-medium truncate max-w-48">{{ userLabel(row) }}</span>
              <code class="font-mono text-xs px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900">{{
                row.method || '—'
              }}</code>
              <span class="text-xs" :class="(row.totalMs ?? 0) >= 1000 ? 'text-danger-500 font-bold' : 'opacity-70'"
                >{{ row.totalMs ?? '-' }}ms</span
              >
              <span v-if="row.error" class="text-xs text-danger-500">{{ t('错误') }}</span>
              <i class="pi pi-angle-right ml-auto opacity-40"></i>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="mt-4 flex justify-center">
      <Paginator v-model:page="currentPage" :total="total" :pageSize="pageSize" @update:page="load" />
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && rows.length === 0" class="text-center py-12 text-primary-theme">
      <i class="pi pi-inbox text-4xl mb-4 block opacity-50"></i>
      <p>{{ t('所选范围内没有行为记录') }}</p>
    </div>

    <!-- 详情对话框：请求摘要 + 请求内全部日志行 -->
    <Dialog v-model:open="detailOpen" :title="t('行为详情')" class="max-w-3xl!">
      <template v-if="detail">
        <div class="space-y-2 text-sm">
          <div><span class="text-primary-theme">时间: </span>{{ formatDate(new Date(detail.created)) }}</div>
          <div>
            <span class="text-primary-theme">用户: </span
            >{{ detail.userName || detail.userEmail || detail.authUserId || t('未认证') }}
          </div>
          <div>
            <span class="text-primary-theme">方法: </span><code class="font-mono">{{ detail.method }}</code>
          </div>
          <div class="flex gap-4 flex-wrap">
            <span>
              <span class="text-primary-theme">耗时: </span>
              <b :class="detail.totalMs >= 1000 ? 'text-danger-500' : ''">{{ detail.totalMs }}ms</b>
            </span>
            <span> <span class="text-primary-theme">reqId: </span>#{{ detail.reqId }} </span>
            <span>
              <span class="text-primary-theme">状态: </span>
              <b :class="detail.error ? 'text-danger-500' : 'text-success-500'">
                {{ detail.error ? t('错误') : t('正常') }}
              </b>
            </span>
          </div>
          <div class="mt-3">
            <div class="text-primary-theme mb-1">{{ t('请求日志') }}（{{ logLines.length }} {{ t('行') }}）:</div>
            <div
              class="max-h-72 overflow-auto font-mono text-xs space-y-0.5 bg-primary-50 dark:bg-primary-950 rounded p-2"
            >
              <div v-for="(line, i) in logLines" :key="i" class="break-all">{{ line }}</div>
            </div>
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted } from 'vue';
import { useAPI } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { Button, Card, MultiSelect, ProgressSpinner } from '@/components/base';
import { Dialog, Select } from '@tsfullstack/shared-frontend/components';
import { formatDate } from '@/utils/format';
import { getErrorMessage } from '@/utils/error';

const { t } = useI18n();
const toast = useToast();
const { API } = useAPI();

/** 行为记录行类型：从后端 diagApi.listBehavior 返回推导 */
type BehaviorResult = Awaited<ReturnType<typeof API.diagApi.listBehavior>>;
type BehaviorRow = BehaviorResult['items'][number];

/** 记录列表：全部用户按时间倒序，可按多选用户/仅错误筛选 */
const rows = shallowRef<BehaviorRow[]>([]);
const total = shallowRef(0);
/** 当前页（从 0 开始，与 Paginator 组件约定一致） */
const currentPage = shallowRef(0);
const pageSize = 20;
const loading = shallowRef(true);

/** 时间范围筛选（天；记录保留 183 天，网安法要求网络日志 ≥6 个月） */
const daysFilter = ref(1);
const daysOptions = [
  { label: t('近 24 小时'), value: '1' },
  { label: t('近 3 天'), value: '3' },
  { label: t('近 7 天'), value: '7' },
  { label: t('近 30 天'), value: '30' },
  { label: t('近 90 天'), value: '90' },
  { label: t('近 183 天'), value: '183' },
];
const daysFilterStr = computed({
  get: () => String(daysFilter.value),
  set: (v) => {
    daysFilter.value = Number(v);
  },
});

/** 用户多选筛选：selectedUserIds 为空 = 全部用户（默认） */
const selectedUserIds = ref<string[]>([]);
interface UserOption {
  id: string;
  email: string;
  nickname: string | null;
}
const users = shallowRef<UserOption[]>([]);
const userOptions = computed(() =>
  users.value.map((u) => ({ label: `${u.nickname || u.email} (${u.email})`, value: u.id })),
);

/** 仅看错误请求 */
const errorOnly = ref(false);

/** 详情对话框 */
const detailOpen = ref(false);
const detail = shallowRef<BehaviorRow | null>(null);
/** 详情日志行（logs 为 JSON 数组，逐行展示） */
const logLines = computed(() => {
  const logs = detail.value?.logs;
  return Array.isArray(logs) ? logs.map((l) => String(l)) : [];
});

onMounted(() => {
  API.db.user
    .findMany({ take: 500, select: { id: true, email: true, nickname: true } })
    .then((list: UserOption[]) => {
      users.value = list;
    })
    .catch((e: unknown) => toast.error(getErrorMessage(e)));
});

/** 回到第一页重载 */
function reload() {
  currentPage.value = 0;
  load();
}

/** 拉取行为记录（userIds 为空 = 全部用户） */
async function load() {
  loading.value = true;
  try {
    const result = await API.diagApi.listBehavior({
      page: currentPage.value + 1,
      pageSize,
      days: daysFilter.value,
      ...(selectedUserIds.value.length > 0 ? { userIds: selectedUserIds.value } : {}),
      ...(errorOnly.value ? { errorOnly: true } : {}),
    });
    rows.value = result.items;
    total.value = result.total;
  } catch (e) {
    toast.error(getErrorMessage(e));
  } finally {
    loading.value = false;
  }
}

/** 打开详情对话框 */
function openDetail(row: BehaviorRow) {
  detail.value = row;
  detailOpen.value = true;
}

/** 用户列展示：名字优先，其次 email，未认证显示 — */
function userLabel(row: BehaviorRow): string {
  return row.userName || row.userEmail || row.authUserId || '—';
}

/** 时:分:秒 展示（时间线节点用） */
function formatTime(d: Date): string {
  return d.toLocaleTimeString('zh-CN', { hour12: false });
}

/** 按日期分组：今天/昨天/具体日期，组内按时间倒序 */
const groupedRows = computed(() => {
  const groups: { date: string; label: string; items: BehaviorRow[] }[] = [];
  const today = new Date();
  const todayStr = today.toDateString();
  const yesterday = new Date(today.getTime() - 86400000).toDateString();
  const byDate = new Map<string, BehaviorRow[]>();
  for (const row of rows.value) {
    const d = new Date(row.created);
    const key = d.toDateString();
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(row);
  }
  for (const [key, items] of byDate) {
    const label =
      key === todayStr ? t('今天') : key === yesterday ? t('昨天') : new Date(key).toLocaleDateString('zh-CN');
    groups.push({ date: key, label, items });
  }
  return groups;
});

/** 筛选条件变化回到第一页并重载 */
watch(
  daysFilter,
  () => {
    currentPage.value = 0;
    load();
  },
  { immediate: true },
);
</script>
