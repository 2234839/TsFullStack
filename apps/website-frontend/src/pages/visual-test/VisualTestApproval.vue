<template>
  <div class="visual-test-page mx-auto max-w-7xl p-4">
    <!-- 顶部工具栏 -->
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-bold">{{ t("视觉回归测试") }}</h1>

      <!-- 服务连接状态 -->
      <Tag :value="serverStatus" :variant="serverOnline ? 'success' : 'danger'" />

      <!-- 服务地址配置 -->
      <div class="ml-auto flex items-center gap-1">
        <Input
          v-model="serverUrlInput"
          :placeholder="t('服务地址')"
          class="w-48"
          @keyup.enter="reconnect"
        />
        <Button :label="t('连接')" size="sm" @click="reconnect" />
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <!-- 环境切换 -->
      <SelectButton
        v-model="currentEnv"
        :options="envOptions"
        option-value="value"
        option-label="label"
        @update:model-value="onEnvChange"
      />

      <!-- 运行测试 -->
      <Button
        :label="t('运行全部测试')"
        icon="pi pi-play"
        size="sm"
        :loading="running"
        :disabled="!serverOnline"
        @click="runAll"
      />

      <!-- 批量批准 -->
      <Button
        :label="t('批准所有待审')"
        icon="pi pi-check"
        variant="primary"
        size="sm"
        :disabled="pendingCount === 0"
        @click="approveAll"
      />

      <!-- 统计 -->
      <div class="ml-auto flex gap-3 text-sm text-gray-500">
        <span
          >{{ t("通过") }}: <b class="text-green-600">{{ stats.approved }}</b></span
        >
        <span
          >{{ t("待审") }}: <b class="text-orange-500">{{ stats.pending }}</b></span
        >
        <span
          >{{ t("失败") }}: <b class="text-red-500">{{ stats.failed }}</b></span
        >
        <span
          >{{ t("错误") }}: <b class="text-red-700">{{ stats.error }}</b></span
        >
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="flex justify-center py-20">
      <ProgressSpinner />
    </div>

    <!-- 场景列表 -->
    <div v-else-if="scenarios.length > 0" class="grid gap-4">
      <ScenarioCard
        v-for="scenario in scenarios"
        :key="scenario.name"
        :scenario="scenario"
        :rpc="vt"
        @approved="refresh"
        @rejected="refresh"
      />
    </div>

    <!-- 空状态 -->
    <div v-else class="py-20 text-center text-gray-400">
      <i class="pi pi-images mb-3 block text-5xl" />
      <p>{{ t("暂无测试结果，请先运行测试") }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import superjson from "superjson";
import { Button, Input, ProgressSpinner, SelectButton, Tag } from "@/components/base";
import { useI18n } from "@/composables/useI18n";
import { createVisualTestRPC, getServerUrl, setServerUrl } from "./rpc";
import ScenarioCard from "./ScenarioCard.vue";
import type { RunReport, Manifest, ScenarioResult, TestEnv } from "@tsfullstack/visual-test";

const { t } = useI18n();

/** visual-test RPC 实例 */
const vt = ref(createVisualTestRPC());
/** 服务地址输入框 */
const serverUrlInput = ref(getServerUrl());
/** 服务是否在线 */
const serverOnline = ref(false);
/** 服务状态文本 */
const serverStatus = computed(() => (serverOnline.value ? t("服务在线") : t("服务离线")));

/** 加载状态 */
const loading = ref(false);
/** 运行中 */
const running = ref(false);
/** 场景结果列表 */
const scenarios = ref<ScenarioResult[]>([]);
/** 当前环境 */
const currentEnv = ref<TestEnv>("local");

/** 环境选项 */
const envOptions = [
  { label: t("本地"), value: "local" as TestEnv },
  { label: t("线上"), value: "production" as TestEnv },
];

/** 统计信息 */
const stats = computed(() => {
  let approved = 0,
    pending = 0,
    failed = 0,
    error = 0;
  for (const s of scenarios.value) {
    if (s.status === "approved") approved++;
    else if (s.status === "pendingNew" || s.status === "pendingDiff") pending++;
    else if (s.status === "failed" || s.status === "rejected") failed++;
    else if (s.status === "error") error++;
  }
  return { approved, pending, failed, error };
});

/** 待审批数量 */
const pendingCount = computed(
  () =>
    scenarios.value.filter((s) => s.status === "pendingNew" || s.status === "pendingDiff").length,
);

/** 检查服务健康状态 */
async function checkHealth() {
  const health = await vt.value.health();
  serverOnline.value = health?.status === "ok";
  if (health?.env) currentEnv.value = health.env as TestEnv;
  return serverOnline.value;
}

/** 重新连接服务 */
async function reconnect() {
  setServerUrl(serverUrlInput.value);
  vt.value = createVisualTestRPC(serverUrlInput.value);
  await checkHealth();
  if (serverOnline.value) {
    await refresh();
  }
}

/** 刷新结果 */
async function refresh() {
  if (!serverOnline.value) return;
  loading.value = true;
  try {
    const data = await vt.value.getResults();
    /** superjson 已在 rpc.ts 层解析 */
    const report = data.report as RunReport | null;
    scenarios.value = report?.results ?? [];
  } finally {
    loading.value = false;
  }
}

/** 运行全部测试 */
async function runAll() {
  running.value = true;
  try {
    const report = (await vt.value.runAll()) as RunReport;
    scenarios.value = report.results;
  } finally {
    running.value = false;
  }
}

/** 批准所有待审 */
async function approveAll() {
  await vt.value.approveAll();
  await refresh();
}

/** 环境切换 */
async function onEnvChange(env: TestEnv) {
  await vt.value.setEnv(env);
  currentEnv.value = env;
  await refresh();
}

onMounted(async () => {
  await checkHealth();
  if (serverOnline.value) {
    await refresh();
  }
});
</script>
