<template>
  <div class="group-entry-page mx-auto max-w-7xl p-6 max-md:p-4">
    <div class="mb-6 flex items-start justify-between gap-4">
      <PageHeader
        no-margin
        icon="pi pi-qrcode text-primary-theme"
        :subtitle="t('维护永久微信群入口，按来源参数统计各项目的引流效果')"
      >
        {{ t('私域引流') }}
      </PageHeader>
      <Button
        icon="pi pi-refresh"
        variant="secondary"
        :label="t('刷新')"
        :loading="spacesLoading || statsLoading"
        @click="refreshAll"
      />
    </div>

    <Card class="mb-6 p-5">
      <h2 class="text-lg font-semibold text-primary-title">{{ t('新建私域空间') }}</h2>
      <p class="mt-1 text-sm leading-6 text-primary-theme">
        {{
          t(
            '空间持有公众号引导和微信群码池，公开链接 /group/<空间名> 永久不变。不同项目投放同一空间时，在链接上加 ?from= 参数即可区分来源，无需单独创建记录。',
          )
        }}
      </p>
      <form
        class="mt-4 grid gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto]"
        @submit.prevent="createSpace"
      >
        <div>
          <Input
            v-model="spaceName"
            class="w-full"
            placeholder="space-key"
            :invalid="spaceName.length > 0 && !spaceNameValid"
            :disabled="creatingSpace"
          />
          <p class="mt-1 text-xs text-primary-theme">{{ t('空间标识：小写字母、数字和连字符') }}</p>
        </div>
        <Input
          v-model="spaceDisplayName"
          class="w-full"
          :placeholder="t('空间显示名称（可选）')"
          :disabled="creatingSpace"
        />
        <Button
          type="submit"
          icon="pi pi-plus"
          :label="t('创建空间')"
          :loading="creatingSpace"
          :disabled="!spaceNameValid"
        />
      </form>
    </Card>

    <section class="mb-8">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-xl font-semibold text-primary-title">{{ t('空间与群码池') }}</h2>
          <p class="mt-1 text-sm text-primary-theme">
            {{ t('一个群满后标记已满，系统自动切到空间池中的下一个有效码；没有有效码时展示公众号引导。') }}
          </p>
        </div>
        <span class="text-sm text-primary-theme">{{ spaces.length }} {{ t('个空间') }}</span>
      </div>
      <div v-if="spaces.length" class="space-y-5">
        <GroupSpaceCard v-for="space in spaces" :key="space.id" :space="space" @changed="loadSpaces" />
      </div>
      <Card v-else class="p-8 text-center text-sm text-primary-theme">
        {{ spacesLoading ? t('正在加载空间…') : t('尚未创建空间，请先创建私域空间。') }}
      </Card>
    </section>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold text-primary-title">{{ t('引流统计') }}</h2>
        <p class="mt-1 text-sm text-primary-theme">
          {{ t('按日期、空间和来源参数（from）聚合，图片与落地页分别统计 PV，UV 按自然日累计') }}
        </p>
      </div>
      <Select v-model="statsDays" class="w-36" :options="statsDayOptions" />
    </div>

    <div class="mb-6 grid gap-4 sm:grid-cols-3">
      <Card v-for="item in statCards" :key="item.key" class="p-5">
        <div class="flex items-center justify-between">
          <span class="text-sm text-primary-theme">{{ item.label }}</span>
          <i :class="['pi', item.icon, 'text-info-500']" />
        </div>
        <p class="mt-2 text-3xl font-semibold text-primary-title">{{ item.value }}</p>
      </Card>
    </div>

    <Card class="overflow-hidden">
      <DataTable
        :columns="statColumns"
        :data="stats"
        :loading="statsLoading"
        :empty-text="t('所选时间范围内暂无引流数据')"
      />
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { Select } from '@tsfullstack/shared-frontend/components';
import { useAPI } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { Button, Card, DataTable, Input } from '@/components/base';
import type { ColumnDef } from '@/components/base/DataTable.vue';
import { getErrorMessage } from '@/utils/error';
import GroupSpaceCard from './groupEntry/GroupSpaceCard.vue';
import { GROUP_ENTRY_KEY_PATTERN, type GroupSpace } from './groupEntry/types';

type StatItem = Awaited<ReturnType<typeof API.groupEntryApi.getStats>>['items'][number];

const { API } = useAPI();
const { t } = useI18n();
const toast = useToast();
const spaces = shallowRef<GroupSpace[]>([]);
const spacesLoading = ref(false);
const stats = shallowRef<StatItem[]>([]);
const statsLoading = ref(false);
const statsDays = ref('30');
const spaceName = ref('');
const spaceDisplayName = ref('');
const creatingSpace = ref(false);
const spaceNameValid = computed(() => GROUP_ENTRY_KEY_PATTERN.test(spaceName.value.trim().toLowerCase()));
const statsDayOptions = computed(() => [
  { label: t('近 7 天'), value: '7' },
  { label: t('近 30 天'), value: '30' },
  { label: t('近 90 天'), value: '90' },
]);
const statTotals = computed(() =>
  stats.value.reduce(
    (totals, item) => ({
      imgPv: totals.imgPv + item.imgPv,
      pagePv: totals.pagePv + item.pagePv,
      pageUv: totals.pageUv + item.pageUv,
    }),
    { imgPv: 0, pagePv: 0, pageUv: 0 },
  ),
);
const statCards = computed(() => [
  { key: 'imgPv', label: t('动态图片 PV'), value: statTotals.value.imgPv, icon: 'pi-image' },
  { key: 'pagePv', label: t('落地页 PV'), value: statTotals.value.pagePv, icon: 'pi-external-link' },
  { key: 'pageUv', label: t('落地页 UV（按日累计）'), value: statTotals.value.pageUv, icon: 'pi-users' },
]);
const statColumns = computed<ColumnDef<StatItem>[]>(() => [
  { key: 'date', title: t('日期') },
  { key: 'space', title: t('空间') },
  { key: 'from', title: t('来源（from）') },
  { key: 'imgPv', title: t('动态图片 PV'), align: 'right' },
  { key: 'pagePv', title: t('落地页 PV'), align: 'right' },
  { key: 'pageUv', title: t('落地页 UV'), align: 'right' },
]);

async function loadSpaces() {
  spacesLoading.value = true;
  try {
    spaces.value = await API.groupEntryApi.listSpaces();
  } catch (error: unknown) {
    toast.error(t('加载空间与群码池失败'), getErrorMessage(error));
  } finally {
    spacesLoading.value = false;
  }
}

async function loadStats() {
  statsLoading.value = true;
  try {
    const result = await API.groupEntryApi.getStats(Number(statsDays.value));
    stats.value = result.items;
  } catch (error: unknown) {
    toast.error(t('加载引流统计失败'), getErrorMessage(error));
  } finally {
    statsLoading.value = false;
  }
}

async function refreshAll() {
  await Promise.all([loadSpaces(), loadStats()]);
}

async function createSpace() {
  if (!spaceNameValid.value || creatingSpace.value) return;
  creatingSpace.value = true;
  const name = spaceName.value.trim().toLowerCase();
  try {
    await API.groupEntryApi.createSpace(name, spaceDisplayName.value.trim() || undefined);
    spaceName.value = '';
    spaceDisplayName.value = '';
    toast.success(t('空间已创建，可继续上传群码或配置公众号'));
    await loadSpaces();
  } catch (error: unknown) {
    toast.error(t('创建空间失败'), getErrorMessage(error));
  } finally {
    creatingSpace.value = false;
  }
}

watch(statsDays, loadStats);
onMounted(refreshAll);
</script>
