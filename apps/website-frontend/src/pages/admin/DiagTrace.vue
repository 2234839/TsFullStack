<template>
  <div class="diag-page p-6 max-w-7xl mx-auto">
    <!-- 页面标题 -->
    <PageHeader icon="pi pi-chart-line text-primary-theme">
      {{ t('请求观测') }}
    </PageHeader>

    <!-- 视图切换：慢请求（落库持久） / 实时请求（内存环形缓冲） -->
    <div class="flex gap-2 mb-4">
      <Button
        :label="t('慢请求（落库）')"
        :variant="viewMode === 'slow' ? 'primary' : 'text-button'"
        size="small"
        @click="switchView('slow')"
      />
      <Button
        :label="t('实时请求（内存）')"
        :variant="viewMode === 'recent' ? 'primary' : 'text-button'"
        size="small"
        @click="switchView('recent')"
      />
    </div>

    <!-- 总览卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
      <Card class="p-4">
        <div class="text-sm text-primary-theme">{{ t('近 24h 慢请求') }}</div>
        <div class="text-2xl font-bold mt-1">{{ overview?.total ?? '--' }}</div>
      </Card>
      <Card class="p-4">
        <div class="text-sm text-danger-theme">{{ t('硬阻塞') }}</div>
        <div class="text-2xl font-bold mt-1 text-danger-500">{{ overview?.byType.blockHeavy ?? '--' }}</div>
        <div class="text-xs text-primary-theme mt-1">{{ t('同步代码冻结事件循环') }}</div>
      </Card>
      <Card class="p-4">
        <div class="text-sm text-primary-theme">{{ t('SQL 慢') }}</div>
        <div class="text-2xl font-bold mt-1">{{ overview?.byType.sqlHeavy ?? '--' }}</div>
        <div class="text-xs text-primary-theme mt-1">{{ t('单条 SQL ≥100ms') }}</div>
      </Card>
      <Card class="p-4">
        <div class="text-sm text-primary-theme">{{ t('事件等待') }}</div>
        <div class="text-2xl font-bold mt-1">{{ overview?.byType.waitHeavy ?? '--' }}</div>
        <div class="text-xs text-primary-theme mt-1">{{ t('外部 API / IO 等待') }}</div>
      </Card>
    </div>

    <!-- 事件循环健康 + 最慢接口 -->
    <Card v-if="overview" class="p-4 mb-4">
      <div class="flex items-center gap-6 flex-wrap">
        <div>
          <span class="text-sm text-primary-theme">{{ t('事件循环最近 100s 最大卡顿') }}: </span>
          <span
            class="font-bold"
            :class="overview.loopLag.recentMaxLagMs >= 50 ? 'text-danger-500' : 'text-success-500'"
          >
            {{ overview.loopLag.recentMaxLagMs }}ms
          </span>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm text-primary-theme">{{ t('最慢接口') }}:</span>
          <Tag
            v-for="m in overview.slowestMethods.slice(0, 5)"
            :key="m.method"
            :value="`${m.method} ×${m.count} avg ${m.avgMs}ms`"
            :variant="m.avgMs >= 1000 ? 'danger' : 'secondary'"
          />
        </div>
      </div>
    </Card>

    <!-- 筛选栏 -->
    <Card class="p-4 mb-4">
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-2">
          <label class="text-sm text-primary-theme whitespace-nowrap">{{ t('时间范围') }}:</label>
          <Select v-model="daysFilterStr" :options="daysOptions" class="w-32" />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm text-primary-theme whitespace-nowrap">{{ t('最慢 SQL') }} ≥</label>
          <Select v-model="sqlFilterStr" :options="sqlOptions" class="w-36" />
        </div>
        <Button :label="t('刷新')" icon="pi pi-refresh" variant="text-button" size="small" @click="loadTraces" />
      </div>
    </Card>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>

    <!-- 记录表格 -->
    <Card v-else-if="rows.length > 0" class="overflow-hidden">
      <DataTable :columns="columns" :data="rows" />
    </Card>

    <!-- 分页（仅慢请求视图，实时流来自内存无需分页） -->
    <div v-if="viewMode === 'slow' && total > pageSize" class="mt-4 flex justify-center">
      <Paginator v-model:page="currentPage" :total="total" :pageSize="pageSize" @update:page="loadTraces" />
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && rows.length === 0" class="text-center py-12 text-primary-theme">
      <i class="pi pi-check-circle text-4xl mb-4 block text-success-500"></i>
      <p v-if="viewMode === 'slow'">{{ t('所选时间范围内没有慢请求，服务健康') }}</p>
      <p v-else>{{ t('还没有请求记录，发起任意请求后刷新即可看到') }}</p>
    </div>

    <!-- 详情对话框 -->
    <Dialog v-model:open="detailOpen" :title="t('请求详情')" class="max-w-5xl!">
      <template v-if="detail">
        <div class="space-y-2 text-sm">
          <div>
            <span class="text-primary-theme">{{ t('方法') }}: </span><code class="font-mono">{{ detail.method }}</code>
          </div>
          <div class="flex gap-4 flex-wrap">
            <span
              ><span class="text-primary-theme">{{ t('总耗时') }}: </span><b>{{ detail.totalMs }}ms</b></span
            >
            <span
              ><span class="text-primary-theme">{{ t('排队') }}: </span>{{ detail.queueWaitMs }}ms</span
            >
            <span v-if="netPhase?.uploadMs != null" :title="t('请求到达（headers 完）→ 入参接收并解析完毕')">
              <span class="text-primary-theme">{{ t('上传') }}: </span>{{ netPhase.uploadMs }}ms
            </span>
            <span
              v-if="netPhase?.sendMs != null"
              :title="t('响应开始写出 → 发送完毕') + (netPhase.respBytes != null ? `（${netPhase.respBytes}B）` : '')"
            >
              <span class="text-primary-theme">{{ t('响应传输') }}: </span>{{ netPhase.sendMs }}ms
            </span>
            <span v-if="detail.authMs != null"
              ><span class="text-primary-theme">{{ t('鉴权') }}: </span>{{ detail.authMs }}ms</span
            >
            <span
              ><span class="text-primary-theme">{{ t('SQL') }}: </span>{{ detail.sqlCount }} 条 / 共
              {{ detail.sqlTotalMs }}ms / 最慢 {{ detail.sqlMaxMs }}ms</span
            >
            <span>
              <span class="text-primary-theme">{{ t('事件循环卡顿') }}: </span>
              <b :class="detail.loopLagMaxMs >= 50 ? 'text-danger-500' : ''">{{ detail.loopLagMaxMs }}ms</b>
            </span>
          </div>
          <div
            v-if="isSlowDetail"
            class="p-2 rounded"
            :class="
              blockingType === '硬阻塞' ? 'bg-danger-500/10 text-danger-600 dark:text-danger-400' : 'bg-primary-500/10'
            "
          >
            {{ t('判定') }}: <b>{{ blockingType }}</b>
            <template v-if="blockingType === '硬阻塞'">
              — {{ t('同步执行冻结了事件循环（同步 SQL / 大对象序列化），期间整个进程无法响应') }}</template
            >
            <template v-else> — {{ t('耗时在外部 IO / API 等待，进程本身未冻结') }}</template>
          </div>
          <div class="mt-3">
            <div class="text-primary-theme mb-2">
              {{ t('Effect 执行栈') }}（{{ t('每行一个 Effect span，按开始时刻定位') }}）:
            </div>
            <div class="space-y-1 text-xs">
              <div v-for="row in waterfallRows" :key="row.key" class="flex items-center gap-2">
                <span class="w-64 shrink-0 truncate font-mono" :title="row.label">{{ row.label }}</span>
                <span class="w-14 shrink-0 text-right text-primary-theme">{{ row.ms }}ms</span>
                <div class="relative h-4 flex-1 rounded bg-primary-100 dark:bg-primary-900">
                  <div
                    class="absolute top-0 h-4 rounded"
                    :class="row.color"
                    :style="{ left: row.left + '%', width: Math.max(row.width, 0.8) + '%' }"
                    :title="`${row.label}: 第 ${row.at}ms 开始，耗时 ${row.ms}ms`"
                  />
                </div>
              </div>
              <!-- 事件循环卡顿叠加行：暗红条标出哪些时段进程被同步代码冻结 -->
              <div v-if="lagItems.length > 0" class="flex items-center gap-2">
                <span class="w-64 shrink-0 font-mono text-danger-500">{{ t('事件循环卡顿') }}</span>
                <span class="w-14 shrink-0 text-right text-danger-500">{{ detail?.loopLagMaxMs }}ms</span>
                <div class="relative h-4 flex-1 rounded bg-danger-500/10">
                  <div
                    v-for="(lag, i) in lagItems"
                    :key="i"
                    class="absolute top-0 h-4 rounded bg-danger-500/70"
                    :style="{
                      left: (lag.at / Math.max(detail?.totalMs ?? 1, 1)) * 100 + '%',
                      width: Math.max((lag.ms / Math.max(detail?.totalMs ?? 1, 1)) * 100, 0.8) + '%',
                    }"
                    :title="`${t('第')} ${lag.at}ms ${t('起冻结')} ${lag.ms}ms`"
                  />
                </div>
              </div>
            </div>
          </div>
          <div class="mt-3">
            <div class="text-primary-theme mb-1">
              {{ t('SQL 明细') }}（{{ sqlItems.length }} 条）<span
                v-if="sqlItems.length === 0"
                class="text-xs opacity-60"
                >— {{ t('诊断接口自身的 SQL（SystemLog/DiagTrace 模型）不进统计，避免诊断污染诊断') }}</span
              >:
            </div>
            <div class="mb-1 flex gap-2 text-xs text-primary-theme">
              <span class="w-16 text-right">{{ t('发生时刻') }}</span>
              <span class="w-16 text-right">{{ t('耗时') }}</span>
              <span>{{ t('语句') }}</span>
            </div>
            <div class="max-h-64 overflow-auto font-mono text-xs space-y-0.5">
              <div v-for="(el, i) in sqlItems" :key="i" class="flex gap-2">
                <span
                  class="text-primary-theme w-16 text-right"
                  :title="t('请求开始后第 ') + el.at + t(' ms 才发出这条查询')"
                  >{{ el.at }}ms</span
                >
                <span
                  :class="el.ms >= 100 ? 'text-danger-500 font-bold' : ''"
                  class="w-16 text-right"
                  :title="
                    t('含 ORM 校验/建查询共 ') +
                    el.ms +
                    t(' ms，其中真实 SQL 执行 ') +
                    (el.execMs ?? '?') +
                    t(' ms，差值为 ZenStack 包装开销')
                  "
                  >{{ el.ms }}ms</span
                >
                <span
                  v-if="el.execMs != null"
                  class="w-20 shrink-0 text-right text-xs opacity-70"
                  :title="t('驱动层真实执行耗时')"
                  >执行{{ el.execMs }}ms</span
                >
                <span>{{ el.model }}.{{ el.operation }}</span>
              </div>
            </div>
          </div>
          <div v-if="driverSqlItems.length > 0" class="mt-3">
            <div class="text-primary-theme mb-1">
              {{ t('驱动层真实执行') }}（{{ driverSqlItems.length }} {{ t('条，总计') }} {{ driverSqlTotalMs }}ms，{{
                t('与上方包装耗时差值即 ORM 开销')
              }}）:
            </div>
            <div class="max-h-48 overflow-auto font-mono text-xs space-y-0.5">
              <div v-for="(el, i) in driverSqlItems" :key="i" class="flex gap-2">
                <span class="text-primary-theme w-16 shrink-0 text-right">{{ el.at }}ms</span>
                <span class="w-16 shrink-0 text-right">{{ el.ms }}ms</span>
                <span class="break-all text-xs opacity-80">{{ el.sql }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, h } from 'vue';
import { useAPI } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { Button, Card, DataTable, ProgressSpinner, Tag } from '@/components/base';
import { Dialog, Select } from '@tsfullstack/shared-frontend/components';
import type { ColumnDef } from '@/components/base/DataTable.vue';
import { formatDate } from '@/utils/format';
import { getErrorMessage } from '@/utils/error';

/** 诊断记录行类型：从后端 diagApi.listTraces 返回推导 */
type DiagListResult = Awaited<ReturnType<typeof API.diagApi.listTraces>>;
type TraceRow = DiagListResult['items'][number];
/** 实时请求行（内存环形缓冲）：与慢请求行同构，含 timeline，可直接展示详情 */
type RecentRow = Awaited<ReturnType<typeof API.diagApi.listRecent>>['items'][number];
type Overview = Awaited<ReturnType<typeof API.diagApi.getOverview>>;
/** 详情行：两种来源共有的结构字段（慢请求列表行与实时行都携带完整 timeline） */
type DetailRow = {
  method: string;
  totalMs: number;
  queueWaitMs: number;
  authMs?: number | null;
  sqlCount: number;
  sqlTotalMs: number;
  sqlMaxMs: number;
  loopLagMaxMs: number;
  timeline: unknown;
};

const { t } = useI18n();
const toast = useToast();
const { API } = useAPI();

/** 总览数据 */
const overview = shallowRef<Overview | null>(null);
/** 记录列表 */
const traces = shallowRef<TraceRow[]>([]);
/** 实时请求列表（内存环形缓冲，含快请求） */
const recentItems = shallowRef<RecentRow[]>([]);
/** 当前视图：慢请求（落库）或实时请求（内存） */
const viewMode = ref<'slow' | 'recent'>('slow');
/** 当前视图的数据行 */
const rows = computed<Array<TraceRow | RecentRow>>(() =>
  viewMode.value === 'recent' ? recentItems.value : traces.value,
);
/** 总数 */
const total = shallowRef(0);
/** 当前页（从 0 开始，与 Paginator 组件约定一致） */
const currentPage = shallowRef(0);
const pageSize = 20;
const loading = shallowRef(true);

/** 时间范围筛选（天，Select 组件 value 为 string，转换存取） */
const daysFilter = ref(7);
const daysOptions = [
  { label: t('近 24 小时'), value: '1' },
  { label: t('近 3 天'), value: '3' },
  { label: t('近 7 天'), value: '7' },
  { label: t('近 30 天'), value: '30' },
];
/** daysFilter 的字符串视图（v-model 绑定用） */
const daysFilterStr = computed({
  get: () => String(daysFilter.value),
  set: (v) => {
    daysFilter.value = Number(v);
  },
});

/** SQL 慢度筛选（minTotalMs 维度同时过滤总耗时，聚焦真正拖后腿的请求） */
const sqlFilter = ref(0);
const sqlOptions = [
  { label: t('全部'), value: '0' },
  { label: t('总耗时 ≥ 500ms'), value: '500' },
  { label: t('总耗时 ≥ 1s'), value: '1000' },
  { label: t('总耗时 ≥ 3s'), value: '3000' },
];
/** sqlFilter 的字符串视图（v-model 绑定用） */
const sqlFilterStr = computed({
  get: () => String(sqlFilter.value),
  set: (v) => {
    sqlFilter.value = Number(v);
  },
});

/** 详情对话框 */
const detailOpen = ref(false);
const detail = shallowRef<DetailRow | null>(null);

/** 详情中的 SQL 明细（从 timeline 提取） */
const sqlItems = computed(() => {
  const tl = detail.value?.timeline;
  if (!Array.isArray(tl)) return [];
  const ev = tl.find((el) => (el as { phase?: string }).phase === 'sqlEvents') as
    | { items?: Array<{ model: string; operation: string; ms: number; execMs?: number; at: number }> }
    | undefined;
  return ev?.items ?? [];
});

/** 网络阶段（timeline 的 net 阶段：上传/响应传输耗时与响应字节） */
const netPhase = computed(() => {
  const tl = detail.value?.timeline;
  if (!Array.isArray(tl)) return null;
  return tl.find((el) => (el as { phase?: string }).phase === 'net') as
    | { uploadMs?: number; sendMs?: number; respBytes?: number }
    | undefined;
});

/** 驱动层真实执行语句（timeline 的 driverSql 阶段，含 SQL 文本与真实耗时） */
const driverSqlItems = computed(() => {
  const tl = detail.value?.timeline;
  if (!Array.isArray(tl)) return [];
  const ev = tl.find((el) => (el as { phase?: string }).phase === 'driverSql') as
    | { items?: Array<{ ms: number; at: number; sql: string }> }
    | undefined;
  return ev?.items ?? [];
});

const driverSqlTotalMs = computed(() => Math.round(driverSqlItems.value.reduce((s, el) => s + el.ms, 0) * 100) / 100);

/** 事件循环卡顿样本（timeline 的 loopLag 阶段：at 为相对请求起点的时刻，ms 为该时段冻结时长） */
const lagItems = computed(() => {
  const tl = detail.value?.timeline;
  if (!Array.isArray(tl)) return [];
  const ev = tl.find((el) => (el as { phase?: string }).phase === 'loopLag') as
    | { items?: Array<{ at: number; ms: number }> }
    | undefined;
  return ev?.items ?? [];
});

/** 阻塞类型判定文案（与后端口径一致：lag≥50 视为硬阻塞） */
const blockingType = computed(() => ((detail.value?.loopLagMaxMs ?? 0) >= 50 ? t('硬阻塞') : t('事件等待')));

/** 是否慢请求（与后端落盘阈值一致）：快请求不显示阻塞判定文案 */
const isSlowDetail = computed(() => {
  const d = detail.value;
  if (!d) return false;
  return d.totalMs >= 500 || d.sqlMaxMs >= 100 || d.loopLagMaxMs >= 50;
});

/** span 树节点（后端 buildSpanTree 输出结构） */
interface SpanTreeNode {
  name: string;
  at: number;
  ms: number;
  children: Array<SpanTreeNode>;
}

/** Effect 执行栈单行：一个 Effect span */
interface WaterfallRow {
  key: string;
  label: string;
  at: number;
  ms: number;
  left: number;
  width: number;
  color: string;
}

const pct = (ms: number, total: number) => (ms / total) * 100;

/** 耗时瀑布图数据：优先用 span 树（每层一条），无 span 树的老记录退回手工埋点（queue/auth/rpc/SQL） */
const waterfallRows = computed<WaterfallRow[]>(() => {
  const d = detail.value;
  if (!d || !Array.isArray(d.timeline)) return [];
  const total = Math.max(d.totalMs, 1);

  /** 数据源 1：span 树（新记录）。子 span 相对父 span 的 at 是绝对时刻，按层级拍平，空隙归属父行 */
  const spanEv = (d.timeline as Array<Record<string, unknown>>).find((el) => el.phase === 'spanTree') as
    | { tree?: SpanTreeNode[] }
    | undefined;
  if (spanEv?.tree?.length) {
    const rows: WaterfallRow[] = [];
    /** 递归拍平：每层按 at 排序，一行一个 span */
    const walk = (nodes: SpanTreeNode[], depth: number, prefix: string): void => {
      const sorted = [...nodes].sort((a, b) => a.at - b.at);
      for (const [i, n] of sorted.entries()) {
        const at = Math.round(n.at);
        const ms = Math.round(n.ms);
        rows.push({
          key: `${prefix}-${i}`,
          label: `${'· '.repeat(depth)}${n.name}`,
          at,
          ms,
          left: pct(at, total),
          width: Math.max(pct(ms, total), 0.8),
          color: depth === 0 ? 'bg-amber-500' : depth === 1 ? 'bg-blue-500' : 'bg-violet-500',
        });
        walk(n.children, depth + 1, `${prefix}-${i}`);
      }
    };
    walk(spanEv.tree, 0, 's');
    return rows;
  }

  /** 数据源 2：手工埋点（老记录兜底） */
  type Ev = { key: string; label: string; at: number; ms: number; execMs?: number; color: string };
  const events: Ev[] = [];
  for (const el of d.timeline as Array<Record<string, unknown>>) {
    const phase = el.phase as string | undefined;
    if (phase === 'queue') {
      events.push({
        key: 'queue',
        label: t('排队等待'),
        at: 0,
        ms: Number(el.ms ?? d.queueWaitMs),
        color: 'bg-primary-400',
      });
    } else if (phase === 'auth' && typeof el.at === 'number') {
      events.push({
        key: 'auth',
        label: `auth · ${t('鉴权')}`,
        at: el.at,
        ms: Number(el.ms ?? 0),
        color: 'bg-blue-500',
      });
    } else if (phase === 'rpc' && typeof el.at === 'number') {
      events.push({
        key: 'rpc',
        label: `rpc · ${t('业务处理')}`,
        at: el.at,
        ms: Number(el.ms ?? 0),
        color: 'bg-amber-500',
      });
    } else if (phase === 'sqlEvents' && Array.isArray(el.items)) {
      for (const [i, item] of (
        el.items as Array<{ model: string; operation: string; ms: number; execMs?: number; at: number }>
      ).entries()) {
        events.push({
          key: `sql-${i}`,
          label: `SQL · ${item.model}.${item.operation}`,
          at: item.at,
          ms: item.ms,
          execMs: item.execMs,
          color: item.ms >= 100 ? 'bg-danger-500' : 'bg-violet-500',
        });
      }
    }
  }
  events.sort((a, b) => a.at - b.at);
  const rows: WaterfallRow[] = [];
  for (const ev of events) {
    rows.push({
      key: ev.key,
      label: ev.label,
      at: ev.at,
      ms: ev.ms,
      left: pct(ev.at, total),
      width: Math.max(pct(ev.ms, total), 0.8),
      color: ev.color,
    });
  }
  return rows;
});

/** 加载总览 */
async function loadOverview() {
  try {
    overview.value = await API.diagApi.getOverview();
  } catch (error: unknown) {
    toast.error(t('加载诊断总览失败'), getErrorMessage(error));
  }
}

/** 加载记录列表 */
async function loadTraces() {
  loading.value = true;
  try {
    const result = await API.diagApi.listTraces({
      page: currentPage.value + 1,
      pageSize,
      days: daysFilter.value,
      minTotalMs: sqlFilter.value,
    });
    traces.value = result.items;
    total.value = result.total;
  } catch (error: unknown) {
    toast.error(t('加载诊断记录失败'), getErrorMessage(error));
  } finally {
    loading.value = false;
  }
}

/** 加载实时请求流（内存环形缓冲，含快请求） */
async function loadRecent() {
  loading.value = true;
  try {
    const result = await API.diagApi.listRecent({ limit: 100 });
    recentItems.value = result.items;
  } catch (error: unknown) {
    toast.error(t('加载实时请求失败'), getErrorMessage(error));
  } finally {
    loading.value = false;
  }
}

/** 切换视图并加载对应数据 */
function switchView(mode: 'slow' | 'recent') {
  viewMode.value = mode;
  if (mode === 'recent') loadRecent();
  else loadTraces();
}

/** 打开详情对话框：两种行都自带 timeline，直接用行数据展示，无需二次请求 */
function openDetail(row: TraceRow | RecentRow) {
  detail.value = row;
  detailOpen.value = true;
}

/** 阻塞类型标签 */
function lagTag(lagMs: number) {
  if (lagMs >= 50) return { value: t('硬阻塞'), variant: 'danger' as const };
  return { value: t('等待'), variant: 'secondary' as const };
}

/** 表格列定义（行类型为两种视图的联合，render 内只用共有字段） */
const columns = computed<ColumnDef<TraceRow | RecentRow>[]>(() => [
  { key: 'created', title: t('时间'), render: (row) => formatDate(new Date(row.created)) },
  { key: 'method', title: t('方法'), render: (row) => h('code', { class: 'font-mono text-xs' }, row.method) },
  {
    key: 'totalMs',
    title: t('总耗时'),
    render: (row) =>
      h('span', { class: row.totalMs >= 1000 ? 'text-danger-500 font-bold' : 'font-medium' }, `${row.totalMs}ms`),
  },
  { key: 'queueWaitMs', title: t('排队'), render: (row) => `${row.queueWaitMs}ms` },
  { key: 'sqlCount', title: t('SQL 条数') },
  {
    key: 'sqlMaxMs',
    title: t('最慢 SQL'),
    render: (row) => h('span', { class: row.sqlMaxMs >= 100 ? 'text-danger-500 font-bold' : '' }, `${row.sqlMaxMs}ms`),
  },
  {
    key: 'loopLagMaxMs',
    title: t('事件循环卡顿'),
    render: (row) => {
      const tag = lagTag(row.loopLagMaxMs);
      return h(Tag, { value: `${tag.value} ${row.loopLagMaxMs}ms`, variant: tag.variant });
    },
  },
  {
    key: 'actions',
    title: t('操作'),
    render: (row) =>
      h(Button, {
        label: t('详情'),
        icon: 'pi pi-search',
        variant: 'text-button',
        size: 'small',
        onClick: () => openDetail(row),
      }),
  },
]);

/** 筛选条件变化回到第一页并重载；immediate 同时承担首屏加载 */
watch(
  [daysFilter, sqlFilter],
  () => {
    currentPage.value = 0;
    loadTraces();
    loadOverview();
  },
  { immediate: true },
);
</script>
