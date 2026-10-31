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
        class="mt-5 grid items-start gap-4 md:grid-cols-2 lg:grid-cols-[minmax(200px,1fr)_minmax(200px,1fr)_auto]"
        @submit.prevent="createSpace"
      >
        <div>
          <label class="mb-1.5 block text-sm font-medium text-primary-title" for="new-space-key">
            {{ t('空间标识') }}
          </label>
          <Input
            id="new-space-key"
            v-model="spaceName"
            class="w-full"
            placeholder="space-key"
            :invalid="spaceName.length > 0 && !spaceNameValid"
            :disabled="creatingSpace"
          />
          <p class="mt-1.5 text-xs text-primary-theme">{{ t('小写字母、数字和连字符，创建后不可修改') }}</p>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-primary-title" for="new-space-display-name">
            {{ t('显示名称') }}
            <span class="ml-1 font-normal text-primary-theme">{{ t('（可选）') }}</span>
          </label>
          <Input
            id="new-space-display-name"
            v-model="spaceDisplayName"
            class="w-full"
            :placeholder="t('空间显示名称（可选）')"
            :disabled="creatingSpace"
          />
          <p class="mt-1.5 text-xs text-primary-theme">{{ t('展示在落地页上的名称，留空则使用空间标识') }}</p>
        </div>
        <div class="md:col-span-2 md:pt-[26px] lg:col-span-1">
          <Button
            type="submit"
            class="h-[42px] w-full md:w-auto"
            icon="pi pi-plus"
            :label="t('创建空间')"
            :loading="creatingSpace"
            :disabled="!spaceNameValid"
          />
        </div>
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

    <section class="mb-8">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-xl font-semibold text-primary-title">{{ t('空间操作员') }}</h2>
          <p class="mt-1 text-sm text-primary-theme">
            {{
              t(
                '被授权的账号可通过公众号消息指令（/更新群码 等）管理对应空间的群码与公众号码，授权粒度为「账号×空间」。',
              )
            }}
          </p>
        </div>
        <Button
          icon="pi pi-refresh"
          variant="secondary"
          :label="t('刷新')"
          :loading="operatorsLoading"
          @click="loadOperators"
        />
      </div>
      <Card class="p-5">
        <form class="flex flex-wrap items-end gap-3" @submit.prevent="addOperator">
          <div class="min-w-48 flex-1">
            <label class="mb-1.5 block text-sm font-medium text-primary-title" for="operator-space">
              {{ t('空间') }}
            </label>
            <Select
              id="operator-space"
              v-model="operatorSpaceId"
              class="w-full"
              :options="spaceOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('选择空间')"
            />
          </div>
          <div class="min-w-56 flex-1">
            <label class="mb-1.5 block text-sm font-medium text-primary-title" for="operator-user">
              {{ t('账号') }}
            </label>
            <Dropdown v-model="userPickerOpen" align="start" @open="openUserPicker">
              <template #trigger>
                <div
                  class="flex h-[38px] w-full cursor-pointer items-center gap-2 rounded-md border border-primary-200 px-3 text-sm text-primary-title transition-colors hover:border-primary-400 dark:border-primary-800 dark:hover:border-primary-600"
                >
                  <template v-if="selectedUser">
                    <span class="truncate">{{ selectedUser.nickname || selectedUser.email }}</span>
                    <span class="truncate text-xs text-primary-theme">{{ selectedUser.email }}</span>
                  </template>
                  <span v-else class="text-primary-theme/70">{{ t('搜索并选择账号…') }}</span>
                  <i class="pi pi-chevron-down ml-auto shrink-0 text-xs text-primary-theme" />
                </div>
              </template>
              <div class="w-72">
                <div class="border-b border-primary-100 p-2 dark:border-primary-900">
                  <Input
                    v-model="userSearchText"
                    class="w-full"
                    :placeholder="t('邮箱 / 昵称搜索')"
                    @update:model-value="debounceSearchUsers"
                  />
                </div>
                <div class="max-h-64 overflow-y-auto p-1">
                  <div v-if="userSearchLoading" class="p-3 text-center text-sm text-primary-theme">
                    <i class="pi pi-spin pi-spinner mr-1"></i>{{ t('搜索中…') }}
                  </div>
                  <div
                    v-else
                    v-for="user in userOptions"
                    :key="user.id"
                    class="cursor-pointer rounded-md px-3 py-2 text-sm transition-colors hover:bg-primary-100 dark:hover:bg-primary-900"
                    @click="selectUser(user)"
                  >
                    <div class="truncate font-medium text-primary-title">{{ user.nickname || user.email }}</div>
                    <div class="truncate text-xs text-primary-theme">{{ user.email }}</div>
                  </div>
                  <div
                    v-if="!userSearchLoading && userOptions.length === 0"
                    class="p-3 text-center text-sm text-primary-theme"
                  >
                    {{ t('未找到匹配账号') }}
                  </div>
                </div>
              </div>
            </Dropdown>
          </div>
          <Button
            type="submit"
            icon="pi pi-user-plus"
            :label="t('授权')"
            :loading="addingOperator"
            :disabled="!operatorSpaceId || !selectedUser"
          />
        </form>
        <div v-if="operators.length" class="mt-5 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-primary-100 text-left text-primary-theme dark:border-primary-900">
                <th class="py-2 pr-4 font-medium">{{ t('账号') }}</th>
                <th class="py-2 pr-4 font-medium">{{ t('空间') }}</th>
                <th class="py-2 pr-4 font-medium">{{ t('授权时间') }}</th>
                <th class="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="op in operators"
                :key="op.id"
                class="border-b border-primary-50 last:border-0 dark:border-primary-950"
              >
                <td class="py-2 pr-4">
                  <div class="font-medium text-primary-title">{{ op.user.nickname || op.user.email }}</div>
                  <div class="text-xs text-primary-theme">{{ op.user.email }}</div>
                </td>
                <td class="py-2 pr-4 text-primary-title">{{ op.space.name }}</td>
                <td class="py-2 pr-4 text-xs text-primary-theme">{{ formatTime(op.created) }}</td>
                <td class="py-2 text-right">
                  <Button
                    icon="pi pi-trash"
                    variant="text-button"
                    severity="danger"
                    size="small"
                    :label="t('移除')"
                    @click="removeOperator(op)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="mt-5 text-sm text-primary-theme">
          {{ operatorsLoading ? t('正在加载操作员…') : t('尚未授权任何空间操作员。') }}
        </p>
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
import { Dropdown, Select } from '@tsfullstack/shared-frontend/components';
import { useAPI } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { Button, Card, DataTable, Input } from '@/components/base';
import type { ColumnDef } from '@/components/base/DataTable.vue';
import { getErrorMessage } from '@/utils/error';
import GroupSpaceCard from './groupEntry/GroupSpaceCard.vue';
import { GROUP_ENTRY_KEY_PATTERN, type GroupSpace } from './groupEntry/types';

type StatItem = Awaited<ReturnType<typeof API.groupEntryApi.getStats>>['items'][number];
type OperatorItem = Awaited<ReturnType<typeof API.groupEntryApi.listOperators>>[number];

const { API } = useAPI();
const { t } = useI18n();
const toast = useToast();
const operators = shallowRef<OperatorItem[]>([]);
const operatorsLoading = ref(false);
const operatorSpaceId = ref<string | null>(null);
const addingOperator = ref(false);
/** 可搜索用户选择器：数据走 ZenStack db.user（策略层自动按当前权限过滤可见范围） */
type UserOption = { id: string; email: string; nickname: string | null };
const userPickerOpen = ref(false);
const selectedUser = shallowRef<UserOption | null>(null);
const userSearchText = ref('');
const userOptions = shallowRef<UserOption[]>([]);
const userSearchLoading = ref(false);
let userSearchTimer: ReturnType<typeof setTimeout> | undefined;

async function searchUsers() {
  userSearchLoading.value = true;
  try {
    const kw = userSearchText.value.trim();
    const where = kw ? { OR: [{ email: { contains: kw } }, { nickname: { contains: kw } }] } : undefined;
    userOptions.value = await API.db.user.findMany({
      where,
      take: 20,
      select: { id: true, email: true, nickname: true },
      orderBy: { created: 'desc' },
    });
  } catch (error: unknown) {
    toast.error(t('搜索账号失败'), getErrorMessage(error));
  } finally {
    userSearchLoading.value = false;
  }
}

function debounceSearchUsers() {
  clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(searchUsers, 300);
}

function openUserPicker() {
  if (userOptions.value.length === 0) searchUsers();
}

function selectUser(user: UserOption) {
  selectedUser.value = user;
  userPickerOpen.value = false;
}
const spaceOptions = computed(() =>
  spaces.value.map((space) => ({ label: space.displayName || space.name, value: String(space.id) })),
);

function formatTime(value: string | Date) {
  return new Date(value).toLocaleString();
}
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
  await Promise.all([loadSpaces(), loadStats(), loadOperators()]);
}

async function loadOperators() {
  operatorsLoading.value = true;
  try {
    operators.value = await API.groupEntryApi.listOperators();
  } catch (error: unknown) {
    toast.error(t('加载空间操作员失败'), getErrorMessage(error));
  } finally {
    operatorsLoading.value = false;
  }
}

async function addOperator() {
  if (!operatorSpaceId.value || !selectedUser.value || addingOperator.value) return;
  addingOperator.value = true;
  try {
    await API.groupEntryApi.addOperator(selectedUser.value.id, Number(operatorSpaceId.value));
    selectedUser.value = null;
    toast.success(t('已授权'));
    await loadOperators();
  } catch (error: unknown) {
    toast.error(t('授权失败'), getErrorMessage(error));
  } finally {
    addingOperator.value = false;
  }
}

async function removeOperator(op: OperatorItem) {
  try {
    await API.groupEntryApi.removeOperator(op.id);
    toast.success(t('已移除授权'));
    await loadOperators();
  } catch (error: unknown) {
    toast.error(t('移除授权失败'), getErrorMessage(error));
  }
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
