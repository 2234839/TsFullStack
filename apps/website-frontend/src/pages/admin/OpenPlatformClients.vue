<script setup lang="ts">
/**
 * 开放平台接入应用管理页
 * 注册/禁用/删除其他网站用本站账号登录的客户端（OAuthClient）
 */
import { useAPI } from '@/api';
import { Button, Input } from '@/components/base';
import { Dialog } from '@tsfullstack/shared-frontend/components';
import { getErrorMessage } from '@/utils/error';
import { formatDate } from '@/utils/format';
import { copyToClipboard } from '@/utils/clipboard';
import { onMounted, ref, shallowRef, h, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useConfirm } from '@/composables/useConfirm';

const { AppAPI } = useAPI();
const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();

/** 接入应用数据类型 */
interface OAuthClientInfo {
  id: number;
  clientId: string;
  name: string;
  homepage: string | null;
  redirectUris: string[];
  disabled: boolean;
  created: Date;
}

const clients = shallowRef<OAuthClientInfo[]>([]);
const loading = shallowRef(false);

/** 创建表单 */
const createDialogVisible = shallowRef(false);
const formName = ref('');
const formHomepage = ref('');
const formRedirectUris = ref('');
const creating = shallowRef(false);

/** 创建成功后一次性展示的凭据 */
const secretDialogVisible = shallowRef(false);
const secretInfo = shallowRef<{ clientId: string; clientSecret: string } | null>(null);

/** 列表列定义 */
const clientColumns = computed(() => [
  {
    key: 'name',
    title: t('应用名称'),
    render: (row: OAuthClientInfo) =>
      h('div', {}, [
        h('div', { class: 'font-medium' }, row.name),
        row.homepage
          ? h('a', { href: row.homepage, target: '_blank', class: 'text-xs text-primary-500' }, row.homepage)
          : null,
      ]),
  },
  {
    key: 'clientId',
    title: t('Client ID'),
    render: (row: OAuthClientInfo) =>
      h(
        'button',
        {
          class: 'font-mono text-xs text-primary-500 hover:underline',
          title: t('点击复制'),
          onClick: () => {
            copyToClipboard(row.clientId);
            toast.success(row.clientId);
          },
        },
        row.clientId,
      ),
  },
  {
    key: 'redirectUris',
    title: t('回调地址'),
    render: (row: OAuthClientInfo) => h('div', { class: 'text-xs whitespace-pre-line' }, row.redirectUris.join('\n')),
  },
  {
    key: 'disabled',
    title: t('状态'),
    render: (row: OAuthClientInfo) =>
      row.disabled
        ? h('span', { class: 'text-danger-500' }, t('已禁用'))
        : h('span', { class: 'text-success-500' }, t('正常')),
  },
  {
    key: 'created',
    title: t('创建时间'),
    render: (row: OAuthClientInfo) => h('span', formatDate(row.created)),
  },
  {
    key: 'actions',
    title: t('操作'),
    render: (row: OAuthClientInfo) =>
      h('div', { class: 'flex gap-2' }, [
        h(
          'button',
          {
            class: 'text-xs text-warning-500 hover:underline',
            onClick: () => toggleDisabled(row),
          },
          row.disabled ? t('启用') : t('禁用'),
        ),
        h(
          'button',
          {
            class: 'text-xs text-danger-500 hover:underline',
            onClick: () => removeClient(row),
          },
          t('删除'),
        ),
      ]),
  },
]);

/** 刷新列表 */
async function refresh() {
  loading.value = true;
  try {
    clients.value = await AppAPI.openPlatformApi.listClients();
  } catch (e) {
    toast.error(t('加载失败'), getErrorMessage(e));
  } finally {
    loading.value = false;
  }
}

/** 打开创建对话框 */
function showCreateDialog() {
  formName.value = '';
  formHomepage.value = '';
  formRedirectUris.value = '';
  createDialogVisible.value = true;
}

/** 提交创建：回调地址一行一个 */
async function onCreate() {
  const uris = formRedirectUris.value
    .split('\n')
    .map((u) => u.trim())
    .filter(Boolean);
  if (!formName.value.trim() || uris.length === 0) {
    toast.error(t('表单不完整'), t('应用名称与回调地址必填'));
    return;
  }
  creating.value = true;
  try {
    const res = await AppAPI.openPlatformApi.createClient({
      name: formName.value,
      homepage: formHomepage.value.trim() || undefined,
      redirectUris: uris,
    });
    createDialogVisible.value = false;
    secretInfo.value = { clientId: res.clientId, clientSecret: res.clientSecret };
    secretDialogVisible.value = true;
    await refresh();
  } catch (e) {
    toast.error(t('创建失败'), getErrorMessage(e));
  } finally {
    creating.value = false;
  }
}

/** 启用/禁用 */
async function toggleDisabled(row: OAuthClientInfo) {
  try {
    await AppAPI.openPlatformApi.setClientDisabled({ id: row.id, disabled: !row.disabled });
    await refresh();
  } catch (e) {
    toast.error(t('操作失败'), getErrorMessage(e));
  }
}

/** 删除（二次确认） */
async function removeClient(row: OAuthClientInfo) {
  const ok = await confirm.require({
    header: t('删除接入应用'),
    message: t('删除后该应用将无法再发起登录授权，确定删除') + `「${row.name}」？`,
  });
  if (!ok) return;
  try {
    await AppAPI.openPlatformApi.deleteClient(row.id);
    toast.success(t('已删除'), row.name);
    await refresh();
  } catch (e) {
    toast.error(t('删除失败'), getErrorMessage(e));
  }
}

/** 复制凭据到剪贴板 */
async function copySecret() {
  if (!secretInfo.value) return;
  await copyToClipboard(`clientId: ${secretInfo.value.clientId}\nclientSecret: ${secretInfo.value.clientSecret}`);
  toast.success(t('凭据已复制到剪贴板'));
}

onMounted(refresh);
</script>

<template>
  <div class="p-4 max-md:p-2 max-[480px]:p-1">
    <div class="flex justify-between items-center mb-4">
      <PageHeader no-margin>
        {{ t('开放平台接入应用') }}
      </PageHeader>
      <Button :label="t('注册应用')" icon="pi pi-plus" variant="primary" @click="showCreateDialog" />
    </div>

    <DataTable :data="clients" :loading="loading" :columns="clientColumns" rowKey="id" striped bordered />

    <!-- 注册应用对话框 -->
    <Dialog v-model:open="createDialogVisible" :title="t('注册接入应用')">
      <div class="flex flex-col gap-3">
        <label class="text-sm">{{ t('应用名称') }}</label>
        <Input v-model="formName" :placeholder="t('例如：我的博客')" />
        <label class="text-sm">{{ t('应用首页（可选）') }}</label>
        <Input v-model="formHomepage" placeholder="https://example.com" />
        <label class="text-sm">{{ t('回调地址（一行一个，精确匹配）') }}</label>
        <textarea
          v-model="formRedirectUris"
          rows="4"
          class="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-transparent p-2 text-sm font-mono"
          placeholder="https://example.com/auth/callback"
        ></textarea>
      </div>
      <template #footer>
        <Button :label="t('取消')" variant="text" @click="createDialogVisible = false" />
        <Button :label="t('创建')" :loading="creating" variant="primary" @click="onCreate" />
      </template>
    </Dialog>

    <!-- 凭据展示对话框（secret 仅此一次） -->
    <Dialog v-model:open="secretDialogVisible" :title="t('应用凭据（仅展示一次）')">
      <div v-if="secretInfo" class="flex flex-col gap-3 text-sm">
        <p class="text-warning-500">{{ t('请立即保存 clientSecret，关闭后将无法再次查看') }}</p>
        <div>
          <div class="text-neutral-500 mb-1">Client ID</div>
          <code class="block break-all rounded bg-neutral-100 dark:bg-neutral-800 p-2 font-mono">
            {{ secretInfo.clientId }}
          </code>
        </div>
        <div>
          <div class="text-neutral-500 mb-1">Client Secret</div>
          <code class="block break-all rounded bg-neutral-100 dark:bg-neutral-800 p-2 font-mono">
            {{ secretInfo.clientSecret }}
          </code>
        </div>
        <Button :label="t('复制凭据')" icon="pi pi-copy" @click="copySecret" />
      </div>
    </Dialog>
  </div>
</template>
