<template>
  <div class="mx-auto max-w-7xl p-6 max-md:p-4">
    <div class="mb-6 flex items-start justify-between gap-4">
      <PageHeader
        no-margin
        icon="pi pi-comments text-primary-theme"
        :subtitle="t('公众号等消息渠道的对话存档，含指令原文与回复；未绑定账号的消息不关联用户。')"
      >
        {{ t('渠道消息') }}
      </PageHeader>
      <Button icon="pi pi-refresh" variant="secondary" :label="t('刷新')" :loading="loading" @click="reload" />
    </div>

    <Card class="mb-4 p-4">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <label class="whitespace-nowrap text-sm text-primary-theme">{{ t('方向') }}:</label>
          <Select v-model="directionFilter" :options="directionOptions" class="w-32" @update:model-value="reload" />
        </div>
        <div class="flex items-center gap-2">
          <label class="whitespace-nowrap text-sm text-primary-theme">{{ t('消息类型') }}:</label>
          <Select v-model="msgTypeFilter" :options="msgTypeOptions" class="w-32" @update:model-value="reload" />
        </div>
        <div class="flex min-w-56 flex-1 items-center gap-2">
          <label class="whitespace-nowrap text-sm text-primary-theme">{{ t('关键词') }}:</label>
          <Input
            v-model="keyword"
            class="w-full"
            :placeholder="t('内容 / openid 关键词，回车搜索')"
            @keydown.enter="reload"
          />
        </div>
      </div>
    </Card>

    <Card class="overflow-hidden">
      <div v-if="loading && messages.length === 0" class="flex justify-center py-12">
        <ProgressSpinner />
      </div>
      <div v-else-if="filtered.length > 0" class="divide-y divide-primary-50 dark:divide-primary-950">
        <div v-for="msg in filtered" :key="msg.id" class="flex items-start gap-3 px-4 py-3">
          <i
            :class="[
              'pi mt-1',
              msg.direction === 'IN' ? 'pi-arrow-down-left text-info-500' : 'pi-arrow-up-right text-success-500',
            ]"
          />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2 text-xs text-primary-theme">
              <span class="font-mono">{{ formatTime(msg.created) }}</span>
              <span class="rounded bg-primary-100 px-1.5 py-0.5 font-mono dark:bg-primary-900">{{ msg.channel }}</span>
              <span class="rounded bg-primary-100 px-1.5 py-0.5 font-mono dark:bg-primary-900">{{ msg.msgType }}</span>
              <span class="font-mono" :title="msg.peerId">{{ shortPeer(msg.peerId) }}</span>
              <span v-if="msg.user" class="text-primary-title">
                {{ msg.user.nickname || msg.user.email }}（{{ msg.user.email }}）
              </span>
            </div>
            <p class="mt-1 break-all text-sm text-primary-title">
              {{ msg.content || (msg.mediaId ? `[图片] ${msg.mediaId}` : '—') }}
            </p>
          </div>
        </div>
      </div>
      <p v-else class="p-8 text-center text-sm text-primary-theme">
        {{ loading ? t('正在加载…') : t('暂无渠道消息') }}
      </p>
      <div v-if="messages.length > 0" class="border-t border-primary-100 p-3 text-center dark:border-primary-900">
        <Button
          variant="text-button"
          size="small"
          :label="t('加载更多')"
          :loading="loading"
          :disabled="!hasMore"
          @click="loadMore"
        />
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { formatDate } from '@/utils/format';
import { Select } from '@tsfullstack/shared-frontend/components';
import { useAPI } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { Button, Card, Input, ProgressSpinner } from '@/components/base';
import { getErrorMessage } from '@/utils/error';

type ChannelMessageItem = Awaited<ReturnType<typeof API.groupEntryApi.listChannelMessages>>[number];

const PAGE_SIZE = 50;
const { API } = useAPI();
const { t } = useI18n();
const toast = useToast();
const messages = shallowRef<ChannelMessageItem[]>([]);
const loading = ref(false);
const hasMore = ref(true);
const directionFilter = ref('');
const msgTypeFilter = ref('');
const keyword = ref('');
const directionOptions = computed(() => [
  { label: t('全部'), value: '' },
  { label: t('收到（IN）'), value: 'IN' },
  { label: t('发出（OUT）'), value: 'OUT' },
]);
const msgTypeOptions = computed(() => [
  { label: t('全部'), value: '' },
  { label: 'text', value: 'text' },
  { label: 'image', value: 'image' },
  { label: 'event', value: 'event' },
]);
/** 前端本地筛选：关键词与消息类型（后端只做游标分页） */
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return messages.value.filter((msg) => {
    if (directionFilter.value && msg.direction !== directionFilter.value) return false;
    if (msgTypeFilter.value && msg.msgType !== msgTypeFilter.value) return false;
    if (!kw) return true;
    return (
      (msg.content ?? '').toLowerCase().includes(kw) ||
      msg.peerId.toLowerCase().includes(kw) ||
      (msg.user?.email ?? '').toLowerCase().includes(kw)
    );
  });
});

/** 统一日期格式化（中文本地化、null 安全） */
function formatTime(value: string | Date) {
  return formatDate(value);
}

function shortPeer(peerId: string) {
  return peerId.length > 14 ? `${peerId.slice(0, 8)}…${peerId.slice(-4)}` : peerId;
}

async function fetchPage(beforeId?: number) {
  loading.value = true;
  try {
    const page = await API.groupEntryApi.listChannelMessages(PAGE_SIZE, beforeId);
    if (beforeId) messages.value = [...messages.value, ...page];
    else messages.value = page;
    hasMore.value = page.length === PAGE_SIZE;
  } catch (error: unknown) {
    toast.error(t('加载渠道消息失败'), getErrorMessage(error));
  } finally {
    loading.value = false;
  }
}

async function reload() {
  await fetchPage();
}

async function loadMore() {
  const last = messages.value[messages.value.length - 1];
  if (last) await fetchPage(last.id);
}

onMounted(reload);
</script>
